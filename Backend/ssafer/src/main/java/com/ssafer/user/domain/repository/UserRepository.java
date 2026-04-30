package com.ssafer.user.domain.repository;

import com.ssafer.user.domain.entity.User;
import com.ssafer.user.domain.enums.AccountStatus;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserRepository extends JpaRepository<User, Long> {

  boolean existsByEmail(String email);

  boolean existsByIdAndAccountStatus(Long id, AccountStatus accountStatus);

  Optional<User> findByEmail(String email);

  Optional<User> findByIdAndAccountStatus(Long id, AccountStatus accountStatus);
}
