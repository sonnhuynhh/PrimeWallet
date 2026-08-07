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

    /**
     * Tìm kiếm user theo từ khóa (phân trang).
     * Dùng cho Admin tra cứu nhanh: email, số điện thoại HOẶC họ tên (không phân biệt hoa thường).
     * LIKE '%keyword%' — tìm chứa keyword, không chỉ khớp đầu chuỗi.
     */
    @org.springframework.data.jpa.repository.Query(
            "SELECT u FROM User u WHERE LOWER(u.email) LIKE LOWER(CONCAT('%', :q, '%')) " +
            "OR LOWER(u.phone) LIKE LOWER(CONCAT('%', :q, '%')) " +
            "OR LOWER(u.fullName) LIKE LOWER(CONCAT('%', :q, '%'))")
    org.springframework.data.domain.Page<User> search(
            @org.springframework.data.repository.query.Param("q") String q,
            org.springframework.data.domain.Pageable pageable);
}
