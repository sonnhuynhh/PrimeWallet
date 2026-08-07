package com.sonnhuynhh.primewallet.wallet.service;

import com.sonnhuynhh.primewallet.wallet.entity.DailyReport;
import com.sonnhuynhh.primewallet.wallet.enums.TransactionStatus;
import com.sonnhuynhh.primewallet.wallet.enums.TransactionType;
import com.sonnhuynhh.primewallet.wallet.repository.DailyReportRepository;
import com.sonnhuynhh.primewallet.wallet.repository.LedgerEntryRepository;
import com.sonnhuynhh.primewallet.wallet.repository.TransactionRepository;
import com.sonnhuynhh.primewallet.common.service.AuditService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.UUID;

/**
 * Service Đối soát dữ liệu (Reconciliation).
 * Đóng vai trò là "Kiểm toán viên" nội bộ của hệ thống.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ReconciliationService {

    private final TransactionRepository transactionRepository;
    private final LedgerEntryRepository ledgerEntryRepository;
    private final DailyReportRepository dailyReportRepository;
    private final AuditService auditService;

    /**
     * Tự động chạy đối soát vào 2:00 sáng mỗi ngày.
     * Quét dữ liệu của ngày hôm trước.
     */
    @Scheduled(cron = "0 0 2 * * ?")
    @Transactional
    public void runDailyReconciliationJob() {
        LocalDate yesterday = LocalDate.now().minusDays(1);
        log.info("Bắt đầu tiến trình đối soát tự động cho ngày: {}", yesterday);
        runReconciliationForDate(yesterday);
    }

    /**
     * Hàm đối soát thủ công (có thể được gọi từ API Admin).
     */
    @Transactional
    public DailyReport runReconciliationForDate(LocalDate date) {
        // 1. Xác định khung giờ quét (00:00:00 -> 23:59:59 của ngày đó)
        LocalDateTime startOfDay = date.atStartOfDay();
        LocalDateTime endOfDay = date.atTime(LocalTime.MAX);

        // 2. Tính tổng giao dịch THÀNH CÔNG trong bảng Transactions
        BigDecimal totalTopUp = transactionRepository.sumAmountByTypeAndStatusAndDate(
                TransactionType.TOPUP, TransactionStatus.SUCCESS, startOfDay, endOfDay);
        
        BigDecimal totalWithdraw = transactionRepository.sumAmountByTypeAndStatusAndDate(
                TransactionType.WITHDRAW, TransactionStatus.SUCCESS, startOfDay, endOfDay);
        
        BigDecimal totalTransfer = transactionRepository.sumAmountByTypeAndStatusAndDate(
                TransactionType.TRANSFER, TransactionStatus.SUCCESS, startOfDay, endOfDay);

        // 3. Tính tổng biến động thực tế trên Sổ Cái (Ledgers)
        // Chú ý: Chuyển tiền nội bộ (Transfer) không làm thay đổi tổng tiền toàn hệ thống 
        // vì tiền chỉ chạy từ ví A sang ví B (CREDIT A, DEBIT B = 0).
        // Tổng biến động toàn hệ thống = Tổng nạp (Tiền vào) - Tổng rút (Tiền ra).
        BigDecimal totalLedgerChange = ledgerEntryRepository.sumNetChangeByDate(startOfDay, endOfDay);

        // 4. Kiểm tra đối soát (Reconciliation Check)
        // Expected Net Change = TopUp - Withdraw
        BigDecimal expectedNetChange = totalTopUp.subtract(totalWithdraw);
        
        String status;
        String notes = "";
        
        if (expectedNetChange.compareTo(totalLedgerChange) == 0) {
            status = "MATCHED";
            log.info("Đối soát THÀNH CÔNG ngày {}. Tổng nạp: {}, Tổng rút: {}, Biến động sổ cái: {}", 
                    date, totalTopUp, totalWithdraw, totalLedgerChange);
        } else {
            status = "MISMATCHED";
            notes = String.format("LỆCH SỐ LIỆU! Giao dịch: %s, Sổ cái: %s", expectedNetChange, totalLedgerChange);
            log.error("CẢNH BÁO: ĐỐI SOÁT LỆCH NGÀY {}. {}", date, notes);
            // Thực tế có thể bắn cảnh báo lên Slack/Email cho Admin tại đây.
        }

        // 5. Lưu báo cáo vào DB
        // Nếu đã từng chạy đối soát cho ngày này rồi thì cập nhật, chưa có thì tạo mới
        DailyReport report = dailyReportRepository.findByReportDate(date)
                .orElse(DailyReport.builder().reportDate(date).build());

        report.setTotalTopUpAmount(totalTopUp);
        report.setTotalWithdrawAmount(totalWithdraw);
        report.setTotalTransferAmount(totalTransfer);
        report.setTotalLedgerChange(totalLedgerChange);
        report.setStatus(status);
        report.setNotes(notes);
        
        DailyReport savedReport = dailyReportRepository.save(report);

        // Ghi Audit Log để hiển thị trên Dashboard
        UUID systemId = UUID.fromString("00000000-0000-0000-0000-000000000000"); // System UUID
        String logMessage = "MATCHED".equals(status) 
                ? String.format("Đối soát ngày %s: Khớp số liệu. Nạp: %s, Rút: %s", date, totalTopUp, totalWithdraw)
                : String.format("Đối soát ngày %s: LỆCH SỐ LIỆU! %s", date, notes);
        auditService.log(systemId, "RECONCILE", logMessage, null);

        return savedReport;
    }
}
