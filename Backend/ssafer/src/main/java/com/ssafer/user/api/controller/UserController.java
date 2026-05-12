package com.ssafer.user.api.controller;

import com.ssafer.auth.api.dto.LoginResponseData;
import com.ssafer.auth.application.service.AuthTokenResult;
import com.ssafer.global.api.ApiResponse;
import com.ssafer.global.error.BusinessException;
import com.ssafer.global.error.ErrorCode;
import com.ssafer.global.security.AuthenticatedActor;
import com.ssafer.global.security.CurrentActorProvider;
import com.ssafer.user.api.dto.CheckEmailRequest;
import com.ssafer.user.api.dto.CheckEmailResponseData;
import com.ssafer.user.api.dto.CheckNicknameRequest;
import com.ssafer.user.api.dto.CheckNicknameResponseData;
import com.ssafer.user.api.dto.RegisterUserRequest;
import com.ssafer.user.api.dto.RegisterUserResponseData;
import com.ssafer.user.api.dto.SetupPasswordRequest;
import com.ssafer.user.api.dto.SocialAccountConnectRequest;
import com.ssafer.user.api.dto.SocialAccountResponseData;
import com.ssafer.user.api.dto.SocialAccountsResponseData;
import com.ssafer.user.api.dto.UpdatePasswordRequest;
import com.ssafer.user.api.dto.UpdateUserProfileRequest;
import com.ssafer.user.api.dto.UserProfileResponseData;
import com.ssafer.user.application.service.UserPasswordService;
import com.ssafer.user.application.service.UserProfileResult;
import com.ssafer.user.application.service.UserProfileService;
import com.ssafer.user.application.service.UserRegistrationService;
import com.ssafer.user.application.service.UserSocialAccountResult;
import com.ssafer.user.application.service.UserSocialAccountService;
import com.ssafer.user.application.service.UserWithdrawalService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/users")
@Tag(name = "?뚯썝", description = "?뚯썝 怨꾩젙 諛??꾨줈??愿??API")
public class UserController {

  private static final String REGISTER_SUCCESS_MESSAGE = "User registration succeeded";
  private static final String CHECK_EMAIL_SUCCESS_MESSAGE = "Email availability check succeeded";
  private static final String CHECK_NICKNAME_SUCCESS_MESSAGE = "Nickname availability check succeeded";
  private static final String PROFILE_RETRIEVE_SUCCESS_MESSAGE = "User profile retrieval succeeded";
  private static final String PROFILE_UPDATE_SUCCESS_MESSAGE = "User profile update succeeded";
  private static final String PASSWORD_SETUP_SUCCESS_MESSAGE = "Password setup succeeded";
  private static final String PASSWORD_CHANGE_SUCCESS_MESSAGE = "Password change succeeded";
  private static final String WITHDRAWAL_SUCCESS_MESSAGE = "User withdrawal succeeded";
  private static final String SOCIAL_ACCOUNTS_RETRIEVE_SUCCESS_MESSAGE = "Connected social accounts retrieval succeeded";
  private static final String SOCIAL_ACCOUNT_CONNECT_SUCCESS_MESSAGE = "Social account connection succeeded";
  private static final String SOCIAL_ACCOUNT_DISCONNECT_SUCCESS_MESSAGE = "Social account disconnection succeeded";

  private final CurrentActorProvider currentActorProvider;
  private final UserRegistrationService userRegistrationService;
  private final UserProfileService userProfileService;
  private final UserPasswordService userPasswordService;
  private final UserSocialAccountService userSocialAccountService;
  private final UserWithdrawalService userWithdrawalService;

  public UserController(
      CurrentActorProvider currentActorProvider,
      UserRegistrationService userRegistrationService,
      UserProfileService userProfileService,
      UserPasswordService userPasswordService,
      UserSocialAccountService userSocialAccountService,
      UserWithdrawalService userWithdrawalService
  ) {
    this.currentActorProvider = currentActorProvider;
    this.userRegistrationService = userRegistrationService;
    this.userProfileService = userProfileService;
    this.userPasswordService = userPasswordService;
    this.userSocialAccountService = userSocialAccountService;
    this.userWithdrawalService = userWithdrawalService;
  }

  @PostMapping
  @Operation(
      summary = "?뚯썝媛??,
      description = "?대찓?? ?됰꽕?? 鍮꾨?踰덊샇濡??뚯썝 怨꾩젙???앹꽦?⑸땲??"
  )
  @ApiResponses({
      @io.swagger.v3.oas.annotations.responses.ApiResponse(
          responseCode = "201",
          description = "?뚯썝媛???깃났",
          content = @Content(schema = @Schema(implementation = RegisterUserResponseData.class))
      ),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(
          responseCode = "400",
          description = "?붿껌 蹂몃Ц???щ컮瑜댁? ?딄굅???꾩닔 媛믪씠 ?꾨씫?섏뿀?듬땲??"
      ),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(
          responseCode = "409",
          description = "?대? 媛?낅맂 ?대찓?쇱씠嫄곕굹 ?ъ슜 以묒씤 ?됰꽕?꾩엯?덈떎."
      )
  })
  public ResponseEntity<ApiResponse<RegisterUserResponseData>> register(
      @Valid @RequestBody RegisterUserRequest request
  ) {
    Long userId = userRegistrationService.register(
        request.email(),
        request.displayName(),
        request.password()
    );

    return ResponseEntity.status(HttpStatus.CREATED)
        .body(ApiResponse.success(REGISTER_SUCCESS_MESSAGE, new RegisterUserResponseData(userId)));
  }

  @GetMapping("/check-email")
  @Operation(
      summary = "?대찓??以묐났 ?뺤씤",
      description = "?뚯썝媛?낆뿉 ?ъ슜?????덈뒗 ?대찓?쇱씤吏 ?뺤씤?⑸땲??"
  )
  @ApiResponses({
      @io.swagger.v3.oas.annotations.responses.ApiResponse(
          responseCode = "200",
          description = "?대찓??以묐났 ?뺤씤 ?깃났",
          content = @Content(schema = @Schema(implementation = CheckEmailResponseData.class))
      ),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(
          responseCode = "400",
          description = "?대찓???뺤떇???щ컮瑜댁? ?딄굅??荑쇰━ ?뚮씪誘명꽣媛 ?꾨씫?섏뿀?듬땲??"
      )
  })
  public ResponseEntity<ApiResponse<CheckEmailResponseData>> checkEmail(
      @Valid @ModelAttribute CheckEmailRequest request
  ) {
    boolean available = userRegistrationService.isEmailAvailable(request.getEmail());
    return ResponseEntity.ok(
        ApiResponse.success(CHECK_EMAIL_SUCCESS_MESSAGE, new CheckEmailResponseData(available))
    );
  }

  @GetMapping("/check-nickname")
  @Operation(
      summary = "?됰꽕??以묐났 ?뺤씤",
      description = "?뚯썝媛???먮뒗 ?꾨줈???섏젙???ъ슜?????덈뒗 ?됰꽕?꾩씤吏 ?뺤씤?⑸땲??"
  )
  @ApiResponses({
      @io.swagger.v3.oas.annotations.responses.ApiResponse(
          responseCode = "200",
          description = "?됰꽕??以묐났 ?뺤씤 ?깃났",
          content = @Content(schema = @Schema(implementation = CheckNicknameResponseData.class))
      ),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(
          responseCode = "400",
          description = "?됰꽕???뺤떇???щ컮瑜댁? ?딄굅??荑쇰━ ?뚮씪誘명꽣媛 ?꾨씫?섏뿀?듬땲??"
      )
  })
  public ResponseEntity<ApiResponse<CheckNicknameResponseData>> checkNickname(
      @Valid @ModelAttribute CheckNicknameRequest request
  ) {
    boolean available = userRegistrationService.isDisplayNameAvailable(request.getNickname());
    return ResponseEntity.ok(
        ApiResponse.success(CHECK_NICKNAME_SUCCESS_MESSAGE, new CheckNicknameResponseData(available))
    );
  }

  @GetMapping("/me")
  @Operation(
      summary = "???꾨줈??議고쉶",
      description = "?꾩옱 濡쒓렇?명븳 ?뚯썝???꾨줈???뺣낫瑜?議고쉶?⑸땲??"
  )
  @ApiResponses({
      @io.swagger.v3.oas.annotations.responses.ApiResponse(
          responseCode = "200",
          description = "?꾨줈??議고쉶 ?깃났",
          content = @Content(schema = @Schema(implementation = UserProfileResponseData.class))
      ),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(
          responseCode = "401",
          description = "?몄쬆???꾩슂?섍굅???좏겙???щ컮瑜댁? ?딆뒿?덈떎."
      ),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(
          responseCode = "403",
          description = "寃뚯뒪??怨꾩젙? ?뚯썝 ?꾩슜 API???묎렐?????놁뒿?덈떎."
      ),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(
          responseCode = "404",
          description = "?뚯썝 ?뺣낫瑜?李얠쓣 ???놁뒿?덈떎."
      )
  })
  public ResponseEntity<ApiResponse<UserProfileResponseData>> getCurrentUserProfile() {
    AuthenticatedActor actor = currentActorProvider.getCurrentActor();
    UserProfileResult profile = userProfileService.getCurrentUserProfile(actor);
    return ResponseEntity.ok(ApiResponse.success(
        PROFILE_RETRIEVE_SUCCESS_MESSAGE,
        new UserProfileResponseData(profile.email(), profile.displayName())
    ));
  }

  @GetMapping("/me/socials")
  @Operation(
      summary = "?곌껐???뚯뀥 怨꾩젙 議고쉶",
      description = "?꾩옱 濡쒓렇?명븳 ?뚯썝??Google, GitHub ?곌껐 ?곹깭瑜?議고쉶?⑸땲??"
  )
  @ApiResponses({
      @io.swagger.v3.oas.annotations.responses.ApiResponse(
          responseCode = "200",
          description = "?곌껐???뚯뀥 怨꾩젙 議고쉶 ?깃났",
          content = @Content(schema = @Schema(implementation = SocialAccountsResponseData.class))
      ),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "?몄쬆???꾩슂?⑸땲??"),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "403", description = "寃뚯뒪??怨꾩젙? ?뚯썝 ?뚯뀥 怨꾩젙??愿由ы븷 ???놁뒿?덈떎."),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "404", description = "?꾩옱 ?쒖꽦 ?뚯썝 ?뺣낫瑜?李얠쓣 ???놁뒿?덈떎.")
  })
  public ResponseEntity<ApiResponse<SocialAccountsResponseData>> getCurrentUserSocialAccounts() {
    AuthenticatedActor actor = currentActorProvider.getCurrentActor();
    SocialAccountsResponseData responseData = new SocialAccountsResponseData(
        userSocialAccountService.getCurrentUserSocialAccounts(actor).stream()
            .map(this::toResponseData)
            .toList()
    );
    return ResponseEntity.ok(ApiResponse.success(
        SOCIAL_ACCOUNTS_RETRIEVE_SUCCESS_MESSAGE,
        responseData
    ));
  }

  @PostMapping("/me/socials/google")
  @Operation(
      summary = "Google 怨꾩젙 ?곌껐",
      description = "OAuth ?멸? 肄붾뱶瑜??ъ슜???꾩옱 濡쒓렇?명븳 ?뚯썝 怨꾩젙??Google 怨꾩젙???곌껐?⑸땲??"
  )
  @ApiResponses({
      @io.swagger.v3.oas.annotations.responses.ApiResponse(
          responseCode = "200",
          description = "Google 怨꾩젙 ?곌껐 ?깃났",
          content = @Content(schema = @Schema(implementation = SocialAccountResponseData.class))
      ),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "400", description = "?멸? 肄붾뱶 ?먮뒗 redirect URI ?붿껌媛믪씠 ?щ컮瑜댁? ?딆뒿?덈떎."),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "?몄쬆???꾩슂?섍굅??Google ?몄쬆???ㅽ뙣?덉뒿?덈떎."),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "409", description = "?대? ?곌껐??Google 怨꾩젙?닿굅???ㅻⅨ ?뚯썝?먭쾶 ?곌껐??怨꾩젙?낅땲??"),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "502", description = "Google OAuth ?쒓났?먮? ?ъ슜?????놁뒿?덈떎.")
  })
  public ResponseEntity<ApiResponse<SocialAccountResponseData>> connectGoogleSocialAccount(
      @Valid @RequestBody(required = false) SocialAccountConnectRequest request
  ) {
    return connectSocialAccount(com.ssafer.auth.domain.enums.OAuthProvider.GOOGLE, request);
  }

  @DeleteMapping("/me/socials/google")
  @Operation(
      summary = "Google 怨꾩젙 ?곌껐 ?댁젣",
      description = "?꾩옱 濡쒓렇?명븳 ?뚯썝 怨꾩젙?먯꽌 Google 怨꾩젙 ?곌껐???댁젣?⑸땲??"
  )
  @ApiResponses({
      @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200", description = "Google 怨꾩젙 ?곌껐 ?댁젣 ?깃났"),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "?몄쬆???꾩슂?⑸땲??"),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "404", description = "?곌껐??Google 怨꾩젙???놁뒿?덈떎."),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "409", description = "留덉?留?濡쒓렇???섎떒? ?댁젣?????놁뒿?덈떎.")
  })
  public ResponseEntity<ApiResponse<Void>> disconnectGoogleSocialAccount() {
    return disconnectSocialAccount(com.ssafer.auth.domain.enums.OAuthProvider.GOOGLE);
  }

  @PostMapping("/me/socials/github")
  @Operation(
      summary = "GitHub 怨꾩젙 ?곌껐",
      description = "OAuth ?멸? 肄붾뱶瑜??ъ슜???꾩옱 濡쒓렇?명븳 ?뚯썝 怨꾩젙??GitHub 怨꾩젙???곌껐?⑸땲??"
  )
  @ApiResponses({
      @io.swagger.v3.oas.annotations.responses.ApiResponse(
          responseCode = "200",
          description = "GitHub 怨꾩젙 ?곌껐 ?깃났",
          content = @Content(schema = @Schema(implementation = SocialAccountResponseData.class))
      ),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "400", description = "?멸? 肄붾뱶 ?먮뒗 redirect URI ?붿껌媛믪씠 ?щ컮瑜댁? ?딆뒿?덈떎."),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "?몄쬆???꾩슂?섍굅??GitHub ?몄쬆???ㅽ뙣?덉뒿?덈떎."),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "409", description = "?대? ?곌껐??GitHub 怨꾩젙?닿굅???ㅻⅨ ?뚯썝?먭쾶 ?곌껐??怨꾩젙?낅땲??"),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "502", description = "GitHub OAuth ?쒓났?먮? ?ъ슜?????놁뒿?덈떎.")
  })
  public ResponseEntity<ApiResponse<SocialAccountResponseData>> connectGithubSocialAccount(
      @Valid @RequestBody(required = false) SocialAccountConnectRequest request
  ) {
    return connectSocialAccount(com.ssafer.auth.domain.enums.OAuthProvider.GITHUB, request);
  }

  @DeleteMapping("/me/socials/github")
  @Operation(
      summary = "GitHub 怨꾩젙 ?곌껐 ?댁젣",
      description = "?꾩옱 濡쒓렇?명븳 ?뚯썝 怨꾩젙?먯꽌 GitHub 怨꾩젙 ?곌껐???댁젣?⑸땲??"
  )
  @ApiResponses({
      @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200", description = "GitHub 怨꾩젙 ?곌껐 ?댁젣 ?깃났"),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "?몄쬆???꾩슂?⑸땲??"),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "404", description = "?곌껐??GitHub 怨꾩젙???놁뒿?덈떎."),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "409", description = "留덉?留?濡쒓렇???섎떒? ?댁젣?????놁뒿?덈떎.")
  })
  public ResponseEntity<ApiResponse<Void>> disconnectGithubSocialAccount() {
    return disconnectSocialAccount(com.ssafer.auth.domain.enums.OAuthProvider.GITHUB);
  }

  @PatchMapping("/me/profile")
  @Operation(
      summary = "???꾨줈???섏젙",
      description = "?꾩옱 濡쒓렇?명븳 ?뚯썝???됰꽕?꾩쓣 ?섏젙?⑸땲??"
  )
  @ApiResponses({
      @io.swagger.v3.oas.annotations.responses.ApiResponse(
          responseCode = "200",
          description = "?꾨줈???섏젙 ?깃났",
          content = @Content(schema = @Schema(implementation = UserProfileResponseData.class))
      ),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(
          responseCode = "400",
          description = "?붿껌 蹂몃Ц???щ컮瑜댁? ?딄굅???꾩닔 媛믪씠 ?꾨씫?섏뿀?듬땲??"
      ),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(
          responseCode = "401",
          description = "?몄쬆???꾩슂?섍굅???좏겙???щ컮瑜댁? ?딆뒿?덈떎."
      ),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(
          responseCode = "403",
          description = "寃뚯뒪??怨꾩젙? ?뚯썝 ?꾩슜 API???묎렐?????놁뒿?덈떎."
      ),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(
          responseCode = "404",
          description = "?뚯썝 ?뺣낫瑜?李얠쓣 ???놁뒿?덈떎."
      ),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(
          responseCode = "409",
          description = "?대? ?ъ슜 以묒씤 ?됰꽕?꾩엯?덈떎."
      )
  })
  public ResponseEntity<ApiResponse<UserProfileResponseData>> updateCurrentUserProfile(
      @Valid @RequestBody(required = false) UpdateUserProfileRequest request
  ) {
    // ?붿껌 蹂몃Ц ?먯껜媛 ?녾굅??displayName ?꾨뱶媛 鍮좎?硫??섎せ???붿껌?쇰줈 蹂몃떎.
    if (request == null || request.displayName() == null) {
      throw new BusinessException(ErrorCode.INVALID_PARAMETER);
    }

    AuthenticatedActor actor = currentActorProvider.getCurrentActor();
    UserProfileResult profile = userProfileService.updateCurrentUserProfile(actor, request.displayName());
    return ResponseEntity.ok(ApiResponse.success(
        PROFILE_UPDATE_SUCCESS_MESSAGE,
        new UserProfileResponseData(profile.email(), profile.displayName())
    ));
  }

  @PatchMapping("/me/password")
  @Operation(
      summary = "鍮꾨?踰덊샇 蹂寃?,
      description = "?꾩옱 濡쒓렇?명븳 ?뚯썝??鍮꾨?踰덊샇瑜?蹂寃쏀빀?덈떎."
  )
  @ApiResponses({
      @io.swagger.v3.oas.annotations.responses.ApiResponse(
          responseCode = "200",
          description = "鍮꾨?踰덊샇 蹂寃??깃났",
          content = @Content(schema = @Schema(implementation = LoginResponseData.class))
      ),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(
          responseCode = "400",
          description = "?붿껌 蹂몃Ц???щ컮瑜댁? ?딄굅???꾩닔 媛믪씠 ?꾨씫?섏뿀?듬땲??"
      ),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(
          responseCode = "401",
          description = "?몄쬆???꾩슂?섍굅???좏겙???щ컮瑜댁? ?딆뒿?덈떎."
      ),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(
          responseCode = "403",
          description = "寃뚯뒪??怨꾩젙? ?뚯썝 ?꾩슜 API???묎렐?????놁뒿?덈떎."
      ),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(
          responseCode = "404",
          description = "?뚯썝 ?뺣낫瑜?李얠쓣 ???놁뒿?덈떎."
      )
  })
  public ResponseEntity<ApiResponse<LoginResponseData>> updateCurrentUserPassword(
      @Valid @RequestBody(required = false) UpdatePasswordRequest request
  ) {
    // 鍮꾨?踰덊샇 蹂寃쎌? ?꾩옱 鍮꾨?踰덊샇? ??鍮꾨?踰덊샇媛 紐⑤몢 ?덉뼱??泥섎━?????덈떎.
    if (request == null || request.currentPassword() == null || request.newPassword() == null) {
      throw new BusinessException(ErrorCode.INVALID_PARAMETER);
    }

    AuthenticatedActor actor = currentActorProvider.getCurrentActor();
    AuthTokenResult tokenResult = userPasswordService.changePassword(
        actor,
        request.currentPassword(),
        request.newPassword()
    );
    return ResponseEntity.ok(ApiResponse.success(
        PASSWORD_CHANGE_SUCCESS_MESSAGE,
        new LoginResponseData(
            tokenResult.accessToken(),
            tokenResult.accessTokenExpiresAt(),
            tokenResult.refreshToken(),
            tokenResult.refreshTokenExpiresAt()
        )
    ));
  }

  @PostMapping("/me/password/setup")
  @Operation(
      summary = "소셜 계정 비밀번호 최초 설정",
      description = "현재 로그인한 소셜 계정에 로컬 로그인용 비밀번호를 최초 설정합니다."
  )
  @ApiResponses({
      @io.swagger.v3.oas.annotations.responses.ApiResponse(
          responseCode = "200",
          description = "鍮꾨?踰덊샇 理쒖큹 ?ㅼ젙 ?깃났",
          content = @Content(schema = @Schema(implementation = LoginResponseData.class))
      ),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(
          responseCode = "400",
          description = "?붿껌 蹂몃Ц???щ컮瑜댁? ?딆뒿?덈떎."
      ),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(
          responseCode = "409",
          description = "?대? 鍮꾨?踰덊샇媛 ?ㅼ젙??怨꾩젙?닿굅???뚯뀥 鍮꾨?踰덊샇 ?ㅼ젙 ??곸씠 ?꾨떃?덈떎."
      ),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(
          responseCode = "401",
          description = "?몄쬆???꾩슂?섍굅???좏겙???щ컮瑜댁? ?딆뒿?덈떎."
      ),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(
          responseCode = "403",
          description = "寃뚯뒪??怨꾩젙? ?뚯썝 ?꾩슜 API???묎렐?????놁뒿?덈떎."
      ),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(
          responseCode = "404",
          description = "?뚯썝 ?뺣낫瑜?李얠쓣 ???놁뒿?덈떎."
      )
  })
  public ResponseEntity<ApiResponse<LoginResponseData>> setupCurrentUserPassword(
      @Valid @RequestBody(required = false) SetupPasswordRequest request
  ) {
    // 理쒖큹 ?ㅼ젙? ??鍮꾨?踰덊샇留?諛쏅릺, 蹂몃Ц ?먯껜媛 ?놁쑝硫??섎せ???붿껌?쇰줈 泥섎━?쒕떎.
    if (request == null || request.newPassword() == null) {
      throw new BusinessException(ErrorCode.INVALID_PARAMETER);
    }

    AuthenticatedActor actor = currentActorProvider.getCurrentActor();
    AuthTokenResult tokenResult = userPasswordService.setupPassword(actor, request.newPassword());
    return ResponseEntity.ok(ApiResponse.success(
        PASSWORD_SETUP_SUCCESS_MESSAGE,
        new LoginResponseData(
            tokenResult.accessToken(),
            tokenResult.accessTokenExpiresAt(),
            tokenResult.refreshToken(),
            tokenResult.refreshTokenExpiresAt()
        )
    ));
  }

  @DeleteMapping
  @Operation(
      summary = "?뚯썝 ?덊눜",
      description = "?꾩옱 濡쒓렇?명븳 ?뚯썝 怨꾩젙??鍮꾪솢?깊솕?섍퀬 refresh token???쒓굅?⑸땲??"
  )
  @ApiResponses({
      @io.swagger.v3.oas.annotations.responses.ApiResponse(
          responseCode = "200",
          description = "?뚯썝 ?덊눜 ?깃났"
      ),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(
          responseCode = "401",
          description = "?몄쬆???꾩슂?섍굅???좏겙???щ컮瑜댁? ?딆뒿?덈떎."
      ),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(
          responseCode = "403",
          description = "寃뚯뒪??怨꾩젙? ?뚯썝 ?꾩슜 API???묎렐?????놁뒿?덈떎."
      ),
      @io.swagger.v3.oas.annotations.responses.ApiResponse(
          responseCode = "404",
          description = "?뚯썝 ?뺣낫瑜?李얠쓣 ???놁뒿?덈떎."
      )
  })
  public ResponseEntity<ApiResponse<Void>> withdrawCurrentUser() {
    // ?덊눜 ??怨꾩젙? 鍮꾪솢?깊솕?섍퀬 refresh token ???④퍡 ?뺣━?쒕떎.
    AuthenticatedActor actor = currentActorProvider.getCurrentActor();
    userWithdrawalService.withdrawCurrentUser(actor);
    return ResponseEntity.ok(ApiResponse.success(WITHDRAWAL_SUCCESS_MESSAGE, null));
  }

  private ResponseEntity<ApiResponse<SocialAccountResponseData>> connectSocialAccount(
      com.ssafer.auth.domain.enums.OAuthProvider provider,
      SocialAccountConnectRequest request
  ) {
    // ?뚯뀥 怨꾩젙 ?곌껐? ?대? 濡쒓렇?몃맂 ?뚯썝 ?몄뀡?먯꽌留??섑뻾?쒕떎.
    if (request == null || request.authorizationCode() == null || request.redirectUri() == null) {
      throw new BusinessException(ErrorCode.INVALID_PARAMETER);
    }

    AuthenticatedActor actor = currentActorProvider.getCurrentActor();
    UserSocialAccountResult result = userSocialAccountService.connectCurrentUserSocialAccount(
        actor,
        provider,
        request.authorizationCode(),
        request.redirectUri()
    );
    return ResponseEntity.ok(ApiResponse.success(
        SOCIAL_ACCOUNT_CONNECT_SUCCESS_MESSAGE,
        toResponseData(result)
    ));
  }

  private ResponseEntity<ApiResponse<Void>> disconnectSocialAccount(
      com.ssafer.auth.domain.enums.OAuthProvider provider
  ) {
    // 怨꾩젙???ъ슜?????녿뒗 ?곹깭濡?留뚮뱾吏 ?딅룄濡?留덉?留?濡쒓렇???섎떒 ?댁젣??留됰뒗??
    AuthenticatedActor actor = currentActorProvider.getCurrentActor();
    userSocialAccountService.disconnectCurrentUserSocialAccount(actor, provider);
    return ResponseEntity.ok(ApiResponse.success(SOCIAL_ACCOUNT_DISCONNECT_SUCCESS_MESSAGE, null));
  }

  private SocialAccountResponseData toResponseData(UserSocialAccountResult result) {
    return new SocialAccountResponseData(
        result.provider(),
        result.connected(),
        result.email(),
        result.connectedAt()
    );
  }
}
