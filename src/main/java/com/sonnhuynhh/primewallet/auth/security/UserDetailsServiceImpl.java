package com.sonnhuynhh.primewallet.auth.security;

import com.sonnhuynhh.primewallet.auth.entity.User;
import com.sonnhuynhh.primewallet.auth.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Implementation của UserDetailsService cho Spring Security.
 *
 * Spring Security cần UserDetailsService để:
 * 1. Tìm user theo username (ở đây là email) khi đăng nhập
 * 2. Lấy thông tin quyền hạn (authorities/roles) của user
 *
 * Khi AuthenticationManager.authenticate() được gọi,
 * Spring Security sẽ tự động gọi loadUserByUsername() để lấy user từ DB,
 * rồi so sánh password client gửi với passwordHash trong DB.
 */
@Service
@RequiredArgsConstructor
public class UserDetailsServiceImpl implements UserDetailsService {

    private final UserRepository userRepository;

    @Override
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new UsernameNotFoundException("Không tìm thấy tài khoản với email: " + email));

        // Chuyển đổi User entity → Spring Security UserDetails
        // ROLE_ prefix là convention bắt buộc của Spring Security
        return new org.springframework.security.core.userdetails.User(
                user.getEmail(),
                user.getPasswordHash(),
                List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole().name()))
        );
    }
}
