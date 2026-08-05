package com.sonnhuynhh.primewallet.wallet.repository;

import com.sonnhuynhh.primewallet.wallet.entity.DailyReport;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.Optional;

@Repository
public interface DailyReportRepository extends JpaRepository<DailyReport, Long> {
    Optional<DailyReport> findByReportDate(LocalDate reportDate);
}
