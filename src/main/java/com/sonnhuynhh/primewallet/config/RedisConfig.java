package com.sonnhuynhh.primewallet.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.serializer.StringRedisSerializer;

/**
 * Cấu hình Redis cho PrimeWallet.
 *
 * Redis là gì trong hệ thống này?
 * - Redis là bộ nhớ cache siêu nhanh (đọc/ghi trong ~0.1ms).
 * - Ta dùng Redis để lưu tạm SỐ DƯ VÍ, tránh phải query PostgreSQL mỗi lần.
 *
 * Ví dụ:
 * - User mở app → App gọi GET /accounts/me → Server đọc Redis (0.1ms) → Trả ngay
 * - Nếu không dùng Redis → Server query PostgreSQL (5-10ms) → Chậm hơn 50-100 lần
 *
 * Tại sao cần tạo RedisConfig thay vì dùng mặc định?
 * - Spring Boot tự tạo RedisTemplate<Object, Object> → dùng JDK serializer → dữ liệu binary khó đọc
 * - Ta muốn RedisTemplate<String, String> → dữ liệu text thuần, dễ debug bằng Redis CLI
 *
 * Khi bạn mở Redis CLI và gõ: GET account:balance:{id}
 * - Mặc định: \xac\xed\x00\x05t\x00\x0f... (binary, không đọc được)
 * - Với config này: "500000.0000" (text, đọc được ngay)
 */
@Configuration
public class RedisConfig {

    /**
     * Tạo RedisTemplate dùng StringSerializer cho cả key và value.
     *
     * @param connectionFactory Spring Boot tự inject dựa trên config trong application.properties
     *                          (spring.data.redis.host, spring.data.redis.port)
     */
    @Bean
    public RedisTemplate<String, String> redisTemplate(RedisConnectionFactory connectionFactory) {
        RedisTemplate<String, String> template = new RedisTemplate<>();
        template.setConnectionFactory(connectionFactory);

        // Dùng StringRedisSerializer cho KEY
        // Key format: "account:balance:{accountId}"
        template.setKeySerializer(new StringRedisSerializer());

        // Dùng StringRedisSerializer cho VALUE
        // Value format: "500000.0000" (số dư dạng text)
        template.setValueSerializer(new StringRedisSerializer());

        // Hash key/value cũng dùng String (cho trường hợp dùng HashMap sau này)
        template.setHashKeySerializer(new StringRedisSerializer());
        template.setHashValueSerializer(new StringRedisSerializer());

        return template;
    }
}
