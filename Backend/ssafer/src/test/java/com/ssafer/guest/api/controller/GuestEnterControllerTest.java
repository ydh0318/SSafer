package com.ssafer.guest.api.controller;

import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.ssafer.global.error.GlobalExceptionHandler;
import com.ssafer.guest.application.service.GuestEnterCommand;
import com.ssafer.guest.application.service.GuestEnterResult;
import com.ssafer.guest.application.service.GuestEnterUseCase;
import java.time.Instant;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentMatcher;
import org.mockito.Mockito;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class GuestEnterControllerTest {

  private MockMvc mockMvc;

  private GuestEnterUseCase guestEnterUseCase;

  @BeforeEach
  void setUp() {
    guestEnterUseCase = Mockito.mock(GuestEnterUseCase.class);
    GuestEnterController controller = new GuestEnterController(guestEnterUseCase);
    mockMvc = MockMvcBuilders.standaloneSetup(controller)
        .setControllerAdvice(new GlobalExceptionHandler())
        .build();
  }

  @Test
  void enterGuestWithDeviceId() throws Exception {
    Instant expiresAt = Instant.parse("2026-04-23T12:00:00Z");
    given(guestEnterUseCase.enter(argThat(matchesDeviceId("web-guest-001"))))
        .willReturn(new GuestEnterResult("guest.temp.token", expiresAt));

    mockMvc.perform(post("/api/v1/guests/enter")
            .contentType(APPLICATION_JSON)
            .content("""
                {
                  "deviceId": "web-guest-001"
                }
                """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.message").exists())
        .andExpect(jsonPath("$.data.guestAccessToken").value("guest.temp.token"))
        .andExpect(jsonPath("$.data.expiresAt").value("2026-04-23T12:00:00Z"));
  }

  @Test
  void enterGuestWithoutDeviceId() throws Exception {
    Instant expiresAt = Instant.parse("2026-04-23T12:00:00Z");
    given(guestEnterUseCase.enter(argThat(matchesDeviceId(null))))
        .willReturn(new GuestEnterResult("guest.temp.token", expiresAt));

    mockMvc.perform(post("/api/v1/guests/enter")
            .contentType(APPLICATION_JSON)
            .content("{}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.message").exists())
        .andExpect(jsonPath("$.data.guestAccessToken").value("guest.temp.token"))
        .andExpect(jsonPath("$.data.expiresAt").value("2026-04-23T12:00:00Z"));

    then(guestEnterUseCase).should().enter(argThat(matchesDeviceId(null)));
  }

  @Test
  void invalidJsonReturnsInvalidParameter() throws Exception {
    mockMvc.perform(post("/api/v1/guests/enter")
            .contentType(APPLICATION_JSON)
            .content("{\"deviceId\":"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_PARAMETER"))
        .andExpect(jsonPath("$.message").value("Request parameter format is invalid"))
        .andExpect(jsonPath("$.data").isMap());
  }

  private ArgumentMatcher<GuestEnterCommand> matchesDeviceId(String expectedDeviceId) {
    return command -> expectedDeviceId == null
        ? command.deviceId() == null
        : expectedDeviceId.equals(command.deviceId());
  }
}
