package com.sonnhuynhh.primewallet.config;

import com.sonnhuynhh.primewallet.auth.entity.Role;
import com.sonnhuynhh.primewallet.auth.entity.User;
import com.sonnhuynhh.primewallet.auth.repository.UserRepository;
import com.sonnhuynhh.primewallet.wallet.repository.AccountRepository;
import com.sonnhuynhh.primewallet.wallet.service.AccountService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Component chạy một lần duy nhất khi ứng dụng khởi động.
 * Nhiệm vụ: Tự động khởi tạo tài khoản Admin nếu chưa tồn tại.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class DatabaseSeeder implements CommandLineRunner {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final AccountService accountService;
    private final AccountRepository accountRepository;

    @Override
    @Transactional
    public void run(String... args) throws Exception {
        String adminEmail = "admin@primewallet.com";
        
        User admin = userRepository.findByEmail(adminEmail).orElse(null);
        
        if (admin == null) {
            log.info("Đang khởi tạo tài khoản Admin mặc định...");
            
            admin = User.builder()
                    .email(adminEmail)
                    .phone("0999999999")
                    .fullName("System Administrator")
                    .passwordHash(passwordEncoder.encode("admin123"))
                    .role(Role.ADMIN)
                    .build();
            
            admin = userRepository.save(admin);
            
            // Tự động tạo ví Fiat mặc định cho Admin
            accountService.createDefaultAccount(admin.getId());
            
            log.info("Đã tạo tài khoản Admin và ví Fiat: {} / mật khẩu: admin123", adminEmail);
        } else {
            log.info("Tài khoản Admin đã tồn tại.");
            // Kiểm tra xem Admin đã có ví chưa, nếu chưa thì tạo
            if (!accountRepository.existsByUserId(admin.getId())) {
                log.info("Admin chưa có ví Fiat, đang tạo mới...");
                accountService.createDefaultAccount(admin.getId());
                log.info("Đã tạo ví Fiat cho Admin hiện có.");
            } else {
                log.info("Admin đã có ví Fiat.");
            }
        }
    }
}
