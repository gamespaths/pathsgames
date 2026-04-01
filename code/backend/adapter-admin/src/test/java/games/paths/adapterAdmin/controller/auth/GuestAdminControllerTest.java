package games.paths.adapterAdmin.controller.auth;

import games.paths.adapters.admin.controller.auth.GuestAdminController;
import games.paths.core.model.auth.GuestInfo;
import games.paths.core.model.auth.GuestStats;
import games.paths.core.port.auth.GuestAdminPort;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;

import static org.hamcrest.Matchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class GuestAdminControllerTest {

        private MockMvc mockMvc;
        private GuestAdminPort guestAdminPort;

        @BeforeEach
        void setup() {
                guestAdminPort = mock(GuestAdminPort.class);
                mockMvc = MockMvcBuilders.standaloneSetup(new GuestAdminController(guestAdminPort)).build();
        }

        // ─── GET /api/admin/guests ───

        @Test
        void listAllGuests_shouldReturn200WithList() throws Exception {
                GuestInfo g1 = GuestInfo.builder()
                                .userUuid("uuid-1").username("guest_1").nickname("guest_1")
                                .role("PLAYER").state(6).language("en")
                                .guestExpiresAt("2099-01-01T00:00:00Z").expired(false).build();
                GuestInfo g2 = GuestInfo.builder()
                                .userUuid("uuid-2").username("guest_2").nickname("guest_2")
                                .role("PLAYER").state(6).language("en")
                                .guestExpiresAt("2020-01-01T00:00:00Z").expired(true).build();

                when(guestAdminPort.listAllGuests()).thenReturn(List.of(g1, g2));

                mockMvc.perform(get("/api/admin/guests"))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$", hasSize(2)))
                                .andExpect(jsonPath("$[0].userUuid").value("uuid-1"))
                                .andExpect(jsonPath("$[0].expired").value(false))
                                .andExpect(jsonPath("$[1].userUuid").value("uuid-2"))
                                .andExpect(jsonPath("$[1].expired").value(true));
        }

        @Test
        void listAllGuests_shouldReturn200EmptyList() throws Exception {
                when(guestAdminPort.listAllGuests()).thenReturn(List.of());

                mockMvc.perform(get("/api/admin/guests"))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$", hasSize(0)));
        }

        // ─── GET /api/admin/guests/stats ───

        @Test
        void getGuestStats_shouldReturn200WithStats() throws Exception {
                when(guestAdminPort.getGuestStats()).thenReturn(new GuestStats(10, 7, 3));

                mockMvc.perform(get("/api/admin/guests/stats"))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.totalGuests").value(10))
                                .andExpect(jsonPath("$.activeGuests").value(7))
                                .andExpect(jsonPath("$.expiredGuests").value(3));
        }

        // ─── GET /api/admin/guests/{uuid} ───

        @Test
        void getGuestByUuid_shouldReturn200WhenFound() throws Exception {
                GuestInfo guest = GuestInfo.builder()
                                .userUuid("uuid-abc").username("guest_abc").nickname("guest_abc")
                                .role("PLAYER").state(6).language("en")
                                .guestExpiresAt("2099-01-01T00:00:00Z").expired(false).build();

                when(guestAdminPort.getGuestByUuid("uuid-abc")).thenReturn(guest);

                mockMvc.perform(get("/api/admin/guests/uuid-abc"))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.userUuid").value("uuid-abc"))
                                .andExpect(jsonPath("$.username").value("guest_abc"));
        }

        @Test
        void getGuestByUuid_shouldReturn404WhenNotFound() throws Exception {
                when(guestAdminPort.getGuestByUuid("nonexistent")).thenReturn(null);

                mockMvc.perform(get("/api/admin/guests/nonexistent"))
                                .andExpect(status().isNotFound())
                                .andExpect(jsonPath("$.error").value("GUEST_NOT_FOUND"));
        }

        // ─── DELETE /api/admin/guests/{uuid} ───

        @Test
        void deleteGuest_shouldReturn200WhenDeleted() throws Exception {
                when(guestAdminPort.deleteGuest("uuid-del")).thenReturn(true);

                mockMvc.perform(delete("/api/admin/guests/uuid-del"))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.status").value("DELETED"))
                                .andExpect(jsonPath("$.uuid").value("uuid-del"));
        }

        @Test
        void deleteGuest_shouldReturn404WhenNotFound() throws Exception {
                when(guestAdminPort.deleteGuest("nonexistent")).thenReturn(false);

                mockMvc.perform(delete("/api/admin/guests/nonexistent"))
                                .andExpect(status().isNotFound())
                                .andExpect(jsonPath("$.error").value("GUEST_NOT_FOUND"));
        }

        // ─── DELETE /api/admin/guests/expired ───

        @Test
        void deleteExpiredGuests_shouldReturn200WithCount() throws Exception {
                when(guestAdminPort.deleteExpiredGuests()).thenReturn(3);

                mockMvc.perform(delete("/api/admin/guests/expired"))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.status").value("CLEANUP_COMPLETE"))
                                .andExpect(jsonPath("$.deletedCount").value(3));
        }

        @Test
        void deleteExpiredGuests_shouldReturn200WhenNoneExpired() throws Exception {
                when(guestAdminPort.deleteExpiredGuests()).thenReturn(0);

                mockMvc.perform(delete("/api/admin/guests/expired"))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.deletedCount").value(0));
        }
}
