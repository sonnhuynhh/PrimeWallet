package com.sonnhuynhh.primewallet.auth.repository;

import com.sonnhuynhh.primewallet.auth.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

/**
 * Repository truy xuất dữ liệu User từ database.
 *
 * JpaRepository cung cấp sẵn các method CRUD cơ bản:
 * - save(), findById(), findAll(), deleteById(), ...
 *
 * Ta chỉ cần khai báo thêm các method tìm kiếm đặc biệt.
 * Spring Data JPA sẽ tự động tạo câu SQL dựa trên tên method.
 */
@Repository
public interface UserRepository extends JpaRepository<User, UUID> {

    /**
     * Tìm user theo email.
     * Dùng khi đăng nhập (email là username).
     */
    Optional<User> findByEmail(String email);

    /**
     * Tìm user theo số điện thoại.
     * Dùng khi chuyển tiền (tìm người nhận qua SĐT).
     */
    Optional<User> findByPhone(String phone);

    /**
     * Kiểm tra email đã tồn tại chưa.
     * Dùng khi đăng ký để tránh trùng email.
     */
    boolean existsByEmail(String email);

    /**
     * Kiểm tra SĐT đã tồn tại chưa.
     * Dùng khi đăng ký để tránh trùng SĐT.
     */
    boolean existsByPhone(String phone);
}
