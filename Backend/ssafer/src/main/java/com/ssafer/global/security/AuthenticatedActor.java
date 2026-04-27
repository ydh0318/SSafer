package com.ssafer.global.security;

/**
 * JWT에서 추출한 "현재 요청자" 정보를 담는 값 객체.
 * 회원/게스트를 하나의 타입으로 다루되, 소유권 판별 시 필요한 식별자만 유지한다.
 */
public record AuthenticatedActor(
    ActorType actorType,
    Long userId,
    String guestOwnerKeyHash
) {

  public enum ActorType {
    MEMBER,
    GUEST
  }

  // 회원 토큰(sub) 기반 요청자를 생성한다.
  public static AuthenticatedActor member(Long userId) {
    if (userId == null) {
      throw new IllegalArgumentException("userId is required for MEMBER");
    }
    return new AuthenticatedActor(ActorType.MEMBER, userId, null);
  }

  // 게스트 토큰(guestOwnerKeyHash) 기반 요청자를 생성한다.
  public static AuthenticatedActor guest(String guestOwnerKeyHash) {
    if (guestOwnerKeyHash == null || guestOwnerKeyHash.isBlank()) {
      throw new IllegalArgumentException("guestOwnerKeyHash is required for GUEST");
    }
    return new AuthenticatedActor(ActorType.GUEST, null, guestOwnerKeyHash);
  }

  public boolean isMember() {
    return actorType == ActorType.MEMBER;
  }

  public boolean isGuest() {
    return actorType == ActorType.GUEST;
  }
}
