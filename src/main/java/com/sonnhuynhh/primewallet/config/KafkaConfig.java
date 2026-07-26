package com.sonnhuynhh.primewallet.config;

import org.apache.kafka.clients.admin.NewTopic;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.config.TopicBuilder;

/**
 * Cấu hình Kafka Topics cho PrimeWallet.
 *
 * Topic là gì?
 * - Kafka tổ chức message theo "topic" (giống kênh radio).
 * - Producer gửi message vào topic.
 * - Consumer đăng ký lắng nghe topic để nhận message.
 *
 * Ví dụ thực tế:
 * - TransactionService gửi event vào topic "wallet.transactions"
 * - NotificationConsumer lắng nghe topic "wallet.transactions"
 * - AI FraudService (Python) cũng lắng nghe topic "wallet.transactions"
 * → Cả 2 đều nhận được event, xử lý song song, không ảnh hưởng nhau.
 *
 * Tại sao đặt tên "wallet.transactions"?
 * - Convention: {domain}.{entity} → dễ phân loại khi có nhiều topic
 * - Sau này có thể thêm: wallet.accounts, notification.emails, ...
 *
 * Producer/Consumer Config:
 * - Cấu hình nằm trong application.properties (spring.kafka.producer.*, spring.kafka.consumer.*)
 * - Spring Boot tự tạo KafkaTemplate bean dựa trên config đó
 * - TransactionEvent chỉ chứa kiểu String, BigDecimal, UUID
 *   → JsonSerializer mặc định của Spring xử lý được, không cần custom ObjectMapper
 */
@Configuration
public class KafkaConfig {

    /**
     * Tên topic — dùng constant để tránh typo.
     * Tất cả Producer và Consumer đều tham chiếu constant này.
     */
    public static final String TRANSACTION_TOPIC = "wallet.transactions";

    /**
     * Đăng ký Topic "wallet.transactions" với Kafka broker.
     *
     * Tham số:
     * - partitions(3): Chia topic thành 3 phân vùng.
     *   → Cho phép 3 consumer đọc song song (tăng throughput).
     *
     * - replicas(1): Chỉ lưu 1 bản sao (vì chỉ có 1 broker).
     *   → Production: replicas(3) → 3 broker giữ bản sao, 1 chết vẫn còn 2.
     */
    @Bean
    public NewTopic transactionTopic() {
        return TopicBuilder.name(TRANSACTION_TOPIC)
                .partitions(3)
                .replicas(1)
                .build();
    }
}
