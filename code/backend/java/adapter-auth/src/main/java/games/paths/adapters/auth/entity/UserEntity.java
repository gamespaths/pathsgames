package games.paths.adapters.auth.entity;

import jakarta.persistence.*;

/**
 * UserEntity - JPA entity mapped to the "users" table.
 * Schema defined by Flyway migration V0.10.1.
 * This entity covers the full users table; guest-specific fields are
 * guest_cookie_token, guest_expires_at, and state=6.
 */
@Entity
@Table(name = "users")
public class UserEntity extends BaseAuthEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String username;

    @Column(name = "password_hash")
    private String passwordHash;

    @Column(name = "email_address")
    private String emailAddress;

    @Column(name = "google_id_sso")
    private String googleIdSso;

    @Column(nullable = false)
    private String role = "PLAYER";

    @Column(nullable = false)
    private Integer state = 1;

    private String nickname;

    private String language = "en";

    @Column(name = "guest_cookie_token")
    private String guestCookieToken;

    @Column(name = "guest_expires_at")
    private String guestExpiresAt;

    @Column(name = "theme_selected")
    private String themeSelected = "default";

    @Column(name = "ts_registration", nullable = false, updatable = false)
    private String tsRegistration;

    @Column(name = "ts_last_access")
    private String tsLastAccess;

    @PrePersist
    protected void onCreate() {
        String now = java.time.Instant.now().toString();
        if (tsRegistration == null) tsRegistration = now;
        if (getTsInsert() == null) setTsInsert(now);
        if (getTsUpdate() == null) setTsUpdate(now);
    }

    // === Getters & Setters ===

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public void setPasswordHash(String passwordHash) {
        this.passwordHash = passwordHash;
    }

    public String getEmailAddress() {
        return emailAddress;
    }

    public void setEmailAddress(String emailAddress) {
        this.emailAddress = emailAddress;
    }

    public String getGoogleIdSso() {
        return googleIdSso;
    }

    public void setGoogleIdSso(String googleIdSso) {
        this.googleIdSso = googleIdSso;
    }

    public String getRole() {
        return role;
    }

    public void setRole(String role) {
        this.role = role;
    }

    public Integer getState() {
        return state;
    }

    public void setState(Integer state) {
        this.state = state;
    }

    public String getNickname() {
        return nickname;
    }

    public void setNickname(String nickname) {
        this.nickname = nickname;
    }

    public String getLanguage() {
        return language;
    }

    public void setLanguage(String language) {
        this.language = language;
    }

    public String getGuestCookieToken() {
        return guestCookieToken;
    }

    public void setGuestCookieToken(String guestCookieToken) {
        this.guestCookieToken = guestCookieToken;
    }

    public String getGuestExpiresAt() {
        return guestExpiresAt;
    }

    public void setGuestExpiresAt(String guestExpiresAt) {
        this.guestExpiresAt = guestExpiresAt;
    }

    public String getThemeSelected() {
        return themeSelected;
    }

    public void setThemeSelected(String themeSelected) {
        this.themeSelected = themeSelected;
    }

    public String getTsRegistration() {
        return tsRegistration;
    }

    public String getTsLastAccess() {
        return tsLastAccess;
    }

    public void setTsLastAccess(String tsLastAccess) {
        this.tsLastAccess = tsLastAccess;
    }
}
