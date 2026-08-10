package com.sonnhuynhh.primewallet.payment.service;

import com.sonnhuynhh.primewallet.common.exception.KycRequiredException;
import com.sonnhuynhh.primewallet.payment.dto.PaymentConfirmResult;
import com.sonnhuynhh.primewallet.payment.config.VnpayConfig;
import com.sonnhuynhh.primewallet.payment.entity.PaymentOrder;
import com.sonnhuynhh.primewallet.payment.enums.PaymentOrderStatus;
import com.sonnhuynhh.primewallet.payment.repository.PaymentOrderRepository;
import com.sonnhuynhh.primewallet.payment.util.VnpayUtil;
import com.sonnhuynhh.primewallet.wallet.dto.TopUpRequest;
import com.sonnhuynhh.primewallet.wallet.service.TransactionService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit test cho PaymentService — luồng IPN VNPAY (Fix #3, #6, #16).
 *
 * Chữ ký được tạo bằng chính VnpayUtil với secret test, nên nhánh xác thực
 * chữ ký được kiểm tra thật (không mock).
 *
 * Bao phủ:
 *   - Sai chữ ký → RspCode 97, KHÔNG nạp tiền
 *   - Không tìm thấy đơn (TxnRef lạ) → RspCode 01
 *   - Fix #16: số tiền callback không khớp đơn → RspCode 04 + đánh dấu FAILED
 *   - IPN thành công → nạp ví bằng userId TỪ ĐƠN + đơn chuyển SUCCESS
 *   - Idempotency: đơn đã SUCCESS → RspCode 02, không nạp lại
 *   - Fix #3: nạp ví ném KycRequired/AccountLocked → đơn FAILED (không nuốt lỗi âm thầm)
 *   - Fix #4: Return URL chỉ hiển thị, KHÔNG gọi topUp
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class PaymentServiceTest {

    @Mock private VnpayConfig vnpayConfig;
    @Mock private TransactionService transactionService;
    @Mock private PaymentOrderRepository paymentOrderRepository;

    @InjectMocks private PaymentService paymentService;

    private static final String SECRET = "TEST_HASH_SECRET_1234567890";
    private static final String TXN_REF = "11111111-1111-1111-1111-111111111111";
    private static final UUID ORDER_USER = UUID.fromString("22222222-2222-2222-2222-222222222222");

    @BeforeEach
    void setUp() {
        when(vnpayConfig.getSecretKey()).thenReturn(SECRET);
    }

    /** Tạo map tham số IPN kèm chữ ký hợp lệ (ký bằng SECRET). */
    private Map<String, String> signedParams(String responseCode, String amountXu) {
        Map<String, String> params = new HashMap<>();
        params.put("vnp_ResponseCode", responseCode);
        params.put("vnp_TxnRef", TXN_REF);
        params.put("vnp_Amount", amountXu);
        params.put("vnp_TransactionStatus", responseCode);
        // Ký trên tập field (bỏ vnp_SecureHash) — giống logic isValidSignature
        String hash = VnpayUtil.hashAllFields(new HashMap<>(params), SECRET);
        params.put("vnp_SecureHash", hash);
        return params;
    }

    private PaymentOrder pendingOrder(BigDecimal amount) {
        return PaymentOrder.builder()
                .id(UUID.randomUUID())
                .txnRef(TXN_REF)
                .userId(ORDER_USER)
                .amount(amount)
                .status(PaymentOrderStatus.PENDING)
                .build();
    }

    @Test
    @DisplayName("IPN sai chữ ký → RspCode 97, không tra đơn, không nạp tiền")
    void ipn_invalidSignature_returns97() {
        Map<String, String> params = new HashMap<>();
        params.put("vnp_ResponseCode", "00");
        params.put("vnp_TxnRef", TXN_REF);
        params.put("vnp_Amount", "10000000");
        params.put("vnp_SecureHash", "deadbeef_wrong_hash");

        String result = paymentService.processIpn(params);

        assertThat(result).contains("\"RspCode\":\"97\"");
        verify(transactionService, never()).topUp(any(), any());
        verify(paymentOrderRepository, never()).findByTxnRef(any());
    }

    @Test
    @DisplayName("IPN với TxnRef không tồn tại → RspCode 01")
    void ipn_orderNotFound_returns01() {
        Map<String, String> params = signedParams("00", "10000000");
        when(paymentOrderRepository.findByTxnRef(TXN_REF)).thenReturn(Optional.empty());

        String result = paymentService.processIpn(params);

        assertThat(result).contains("\"RspCode\":\"01\"");
        verify(transactionService, never()).topUp(any(), any());
    }

    @Test
    @DisplayName("Fix #16: số tiền callback KHÔNG khớp đơn → RspCode 04 + đơn FAILED")
    void ipn_amountMismatch_returns04_andMarksFailed() {
        // Đơn kỳ vọng 100,000 VNĐ → 10,000,000 xu. Callback báo 5,000,000 xu (50k).
        PaymentOrder order = pendingOrder(new BigDecimal("100000"));
        when(paymentOrderRepository.findByTxnRef(TXN_REF)).thenReturn(Optional.of(order));
        Map<String, String> params = signedParams("00", "5000000");

        String result = paymentService.processIpn(params);

        assertThat(result).contains("\"RspCode\":\"04\"");
        verify(transactionService, never()).topUp(any(), any());
        ArgumentCaptor<PaymentOrder> captor = ArgumentCaptor.forClass(PaymentOrder.class);
        verify(paymentOrderRepository).save(captor.capture());
        assertThat(captor.getValue().getStatus()).isEqualTo(PaymentOrderStatus.FAILED);
    }

    @Test
    @DisplayName("IPN thành công → nạp ví bằng userId TỪ ĐƠN, đơn chuyển SUCCESS, RspCode 00")
    void ipn_success_creditsWalletFromOrderUser() {
        PaymentOrder order = pendingOrder(new BigDecimal("100000"));
        when(paymentOrderRepository.findByTxnRef(TXN_REF)).thenReturn(Optional.of(order));
        Map<String, String> params = signedParams("00", "10000000"); // 100,000 * 100

        String result = paymentService.processIpn(params);

        assertThat(result).contains("\"RspCode\":\"00\"");

        // topUp phải được gọi với userId TỪ ĐƠN (không phải từ callback)
        ArgumentCaptor<TopUpRequest> reqCaptor = ArgumentCaptor.forClass(TopUpRequest.class);
        verify(transactionService).topUp(reqCaptor.capture(), eq(ORDER_USER));
        assertThat(reqCaptor.getValue().getAmount()).isEqualByComparingTo("100000");
        // idempotencyKey = TxnRef (UUID)
        assertThat(reqCaptor.getValue().getIdempotencyKey()).isEqualTo(UUID.fromString(TXN_REF));

        assertThat(order.getStatus()).isEqualTo(PaymentOrderStatus.SUCCESS);
    }

    @Test
    @DisplayName("Idempotency: đơn đã SUCCESS → RspCode 02, KHÔNG nạp lại")
    void ipn_alreadyProcessed_returns02() {
        PaymentOrder order = pendingOrder(new BigDecimal("100000"));
        order.setStatus(PaymentOrderStatus.SUCCESS);
        when(paymentOrderRepository.findByTxnRef(TXN_REF)).thenReturn(Optional.of(order));
        Map<String, String> params = signedParams("00", "10000000");

        String result = paymentService.processIpn(params);

        assertThat(result).contains("\"RspCode\":\"02\"");
        verify(transactionService, never()).topUp(any(), any());
    }

    @Test
    @DisplayName("Fix #3: nạp ví ném KycRequired → đơn FAILED (KHÔNG nuốt lỗi âm thầm)")
    void ipn_topUpBusinessError_marksOrderFailed() {
        PaymentOrder order = pendingOrder(new BigDecimal("100000"));
        when(paymentOrderRepository.findByTxnRef(TXN_REF)).thenReturn(Optional.of(order));
        when(transactionService.topUp(any(), eq(ORDER_USER)))
                .thenThrow(new KycRequiredException("Cần KYC"));
        Map<String, String> params = signedParams("00", "10000000");

        String result = paymentService.processIpn(params);

        // Trả 00 để VNPAY khỏi gọi lại, nhưng đơn PHẢI ở trạng thái FAILED để đối soát
        assertThat(result).contains("\"RspCode\":\"00\"");
        assertThat(order.getStatus()).isEqualTo(PaymentOrderStatus.FAILED);
        assertThat(order.getFailureReason()).contains("Nạp ví thất bại");
    }

    @Test
    @DisplayName("VNPAY báo thất bại (ResponseCode != 00) → đơn CANCELLED, không nạp")
    void ipn_paymentFailed_marksCancelled() {
        PaymentOrder order = pendingOrder(new BigDecimal("100000"));
        when(paymentOrderRepository.findByTxnRef(TXN_REF)).thenReturn(Optional.of(order));
        Map<String, String> params = signedParams("24", "10000000"); // 24 = user hủy

        String result = paymentService.processIpn(params);

        assertThat(result).contains("\"RspCode\":\"00\"");
        assertThat(order.getStatus()).isEqualTo(PaymentOrderStatus.CANCELLED);
        verify(transactionService, never()).topUp(any(), any());
    }

    // ==================== RETURN URL (Fix #4) ====================

    @Test
    @DisplayName("Fix #4: Return URL chỉ hiển thị trạng thái, TUYỆT ĐỐI không gọi topUp")
    void returnDisplay_doesNotMoveMoney() {
        Map<String, String> params = signedParams("00", "10000000");

        String message = paymentService.handleReturnDisplay(params);

        assertThat(message).contains("Thanh toán thành công");
        verify(transactionService, never()).topUp(any(), any());
        verify(paymentOrderRepository, never()).save(any());
    }

    @Test
    @DisplayName("Return URL sai chữ ký → thông báo lỗi, không gọi topUp")
    void returnDisplay_invalidSignature() {
        Map<String, String> params = new HashMap<>();
        params.put("vnp_ResponseCode", "00");
        params.put("vnp_SecureHash", "wrong");

        String message = paymentService.handleReturnDisplay(params);

        assertThat(message).contains("Chữ ký không hợp lệ");
        verify(transactionService, never()).topUp(any(), any());
    }

    @Test
    @DisplayName("Confirm return: thành công → cộng tiền vào ví (fallback khi IPN không tới localhost)")
    void confirmFromReturn_success_creditsWallet() {
        PaymentOrder order = pendingOrder(new BigDecimal("100000"));
        when(paymentOrderRepository.findByTxnRef(TXN_REF)).thenReturn(Optional.of(order));
        Map<String, String> params = signedParams("00", "10000000");

        PaymentConfirmResult result = paymentService.confirmFromReturn(params, ORDER_USER);

        assertThat(result.isCredited()).isTrue();
        verify(transactionService).topUp(any(), eq(ORDER_USER));
        assertThat(order.getStatus()).isEqualTo(PaymentOrderStatus.SUCCESS);
    }

    @Test
    @DisplayName("Confirm return: user khác → không cộng tiền")
    void confirmFromReturn_wrongUser_forbidden() {
        PaymentOrder order = pendingOrder(new BigDecimal("100000"));
        when(paymentOrderRepository.findByTxnRef(TXN_REF)).thenReturn(Optional.of(order));
        Map<String, String> params = signedParams("00", "10000000");

        PaymentConfirmResult result = paymentService.confirmFromReturn(
                params, UUID.fromString("33333333-3333-3333-3333-333333333333"));

        assertThat(result.isCredited()).isFalse();
        verify(transactionService, never()).topUp(any(), any());
    }
}
