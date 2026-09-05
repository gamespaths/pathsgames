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
import static org.mockito.ArgumentMatchers.any;
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
                GuestInfo g1 = new GuestInfo("uuid-1", "guest_1", "guest_1", "PLAYER", 6,
                                null, "2099-01-01T00:00:00Z", "en", null, null, false);
                GuestInfo g2 = new GuestInfo("uuid-2", "guest_2", "guest_2", "PLAYER", 6,
                                null, "2020-01-01T00:00:00Z", "en", null, null, true);

                // v0.36.2 — the endpoint answers the paged envelope, not a bare array.
                when(guestAdminPort.listGuestsPage(any())).thenReturn(
                                new games.paths.core.model.auth.GuestInfoPage(
                                                List.of(g1, g2), "next-page", 50));

                mockMvc.perform(get("/api/admin/guests"))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.items", hasSize(2)))
                                .andExpect(jsonPath("$.nextCursor").value("next-page"))
                                .andExpect(jsonPath("$.limit").value(50))
                                .andExpect(jsonPath("$.items[0].userUuid").value("uuid-1"))
                                .andExpect(jsonPath("$.items[0].expired").value(false))
                                .andExpect(jsonPath("$.items[1].userUuid").value("uuid-2"))
                                .andExpect(jsonPath("$.items[1].expired").value(true));
        }

        @Test
        void listAllGuests_shouldReturn200EmptyList() throws Exception {
                when(guestAdminPort.listGuestsPage(any())).thenReturn(
                                new games.paths.core.model.auth.GuestInfoPage(List.of(), null, 50));

                mockMvc.perform(get("/api/admin/guests"))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.items", hasSize(0)))
                                .andExpect(jsonPath("$.nextCursor").doesNotExist());
        }

        // ─── GET|DELETE /api/admin/guests/stale (v0.36.2) ───

        @Test
        void previewStaleGuests_shouldReportBothCounts() throws Exception {
                when(guestAdminPort.previewStaleGuests(90)).thenReturn(
                                new games.paths.core.model.auth.StaleGuestsSummary(412, 517));

                mockMvc.perform(get("/api/admin/guests/stale?olderThanDays=90"))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.guests").value(412))
                                .andExpect(jsonPath("$.matches").value(517));
        }

        @Test
        void deleteStaleGuests_shouldTakeTheMatchesWithThem() throws Exception {
                when(guestAdminPort.deleteStaleGuests(90)).thenReturn(
                                new games.paths.core.model.auth.StaleGuestsSummary(412, 517));

                mockMvc.perform(delete("/api/admin/guests/stale?olderThanDays=90"))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.guests").value(412))
                                .andExpect(jsonPath("$.matches").value(517))
                                .andExpect(jsonPath("$.status").value("CLEANUP_COMPLETE"));
        }

        @Test
        void staleGuests_shouldRefuseWithoutABound() throws Exception {
                // Without olderThanDays the purge would take EVERY guest: refuse, never guess.
                mockMvc.perform(delete("/api/admin/guests/stale"))
                                .andExpect(status().isBadRequest())
                                .andExpect(jsonPath("$.error").value("INVALID_INPUT"));
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
                GuestInfo guest = new GuestInfo("uuid-abc", "guest_abc", "guest_abc",
                                "PLAYER", 6, null, "2099-01-01T00:00:00Z", "en", null, null, false);

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
