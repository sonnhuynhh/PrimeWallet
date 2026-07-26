package com.sonnhuynhh.primewallet.wallet.event;

import com.sonnhuynhh.primewallet.config.KafkaConfig;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.SendResult;
import org.springframework.stereotype.Service;

import java.util.concurrent.CompletableFuture;

/**
 * Kafka Producer — Gửi event giao dịch lên Kafka topic.
 *
 * Cách hoạt động:
 * 1. TransactionService gọi publisher.publish(event) sau giao dịch thành công
 * 2. Publisher gửi event lên topic "wallet.transactions" qua KafkaTemplate
 * 3. Kafka lưu message trên disk (persist)
 * 4. Tất cả Consumer đăng ký topic này sẽ nhận được message
 *
 * KafkaTemplate là gì?
 * - Giống như JdbcTemplate cho database, KafkaTemplate là lớp trừu tượng
 *   để gửi message đến Kafka.
 * - Spring Boot tự động tạo KafkaTemplate dựa trên config trong application.properties
 * - KafkaTemplate<String, TransactionEvent>:
 *   + String = kiểu của Key (transactionId.toString())
 *   + TransactionEvent = kiểu của Value (body message)
 *
 * Tại sao gửi bất đồng bộ (async)?
 * - Kafka gửi message qua mạng → có thể chậm 10-100ms
 * - Nếu đồng bộ: User phải chờ → trải nghiệm kém
 * - Bất đồng bộ: Gửi xong trả kết quả cho User ngay, Kafka xử lý nền
 * - Nếu gửi lỗi → chỉ log warning, KHÔNG ảnh hưởng giao dịch
 *   (giao dịch đã commit DB rồi, event chỉ là thông báo phụ)
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class TransactionEventPublisher {

    private final KafkaTemplate<String, TransactionEvent> kafkaTemplate;

    /**
     * Gửi event giao dịch lên Kafka.
     *
     * @param event Thông tin giao dịch cần gửi
     *
     * Luồng xử lý:
     * 1. kafkaTemplate.send() → gửi message KHÔNG ĐỒNG BỘ → trả về CompletableFuture
     * 2. whenComplete() → callback xử lý kết quả:
     *    - Thành công: Log thông tin topic, partition, offset
     *    - Thất bại: Log cảnh báo (KHÔNG throw exception)
     *
     * Key = transactionId → Kafka dùng key để hash và chọn partition.
     * Cùng transactionId → cùng partition → đảm bảo thứ tự message
     * cho cùng 1 giao dịch (nếu gửi nhiều event cho 1 giao dịch).
     */
    public void publish(TransactionEvent event) {
        String key = event.getTransactionId().toString();

        CompletableFuture<SendResult<String, TransactionEvent>> future =
                kafkaTemplate.send(KafkaConfig.TRANSACTION_TOPIC, key, event);

        future.whenComplete((result, exception) -> {
            if (exception != null) {
                // Gửi lỗi → CHỈ LOG, không throw
                // Giao dịch đã ghi DB thành công, event chỉ là bước phụ
                log.warn("Không thể gửi event cho giao dịch {}: {}",
                        event.getReferenceNumber(), exception.getMessage());
            } else {
                // Gửi thành công → Log thông tin để debug
                log.info("Event giao dịch đã gửi: {} → topic={}, partition={}, offset={}",
                        event.getReferenceNumber(),
                        result.getRecordMetadata().topic(),
                        result.getRecordMetadata().partition(),
                        result.getRecordMetadata().offset());
            }
        });
    }
}
