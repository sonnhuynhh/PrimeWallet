package com.sonnhuynhh.primewallet;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;

@SpringBootApplication
@EnableAsync // Bật xử lý bất đồng bộ — cần thiết cho AuditService @Async
public class PrimeWalletApplication {

    public static void main(String[] args) {
        SpringApplication.run(PrimeWalletApplication.class, args);
    }

}
