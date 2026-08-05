package com.sonnhuynhh.primewallet.wallet.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Lưu trữ báo cáo đối soát cuối ngày.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "daily_reports")
public class DailyReport {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private LocalDate reportDate;

    @Column(nullable = false, precision = 19, scale = 4)
    private BigDecimal totalTopUpAmount;

    @Column(nullable = false, precision = 19, scale = 4)
    private BigDecimal totalWithdrawAmount;

    @Column(nullable = false, precision = 19, scale = 4)
    private BigDecimal totalTransferAmount;
    
    @Column(nullable = false, precision = 19, scale = 4)
    private BigDecimal totalLedgerChange; // Tổng thay đổi trên sổ cái

    /**
     * MATCHED: Khớp số liệu.
     * MISMATCHED: Lệch số liệu.
     */
    @Column(nullable = false)
    private String status;

    private String notes;

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime createdAt;
}
