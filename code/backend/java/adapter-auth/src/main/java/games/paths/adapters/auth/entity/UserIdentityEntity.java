package games.paths.adapters.auth.entity;

import jakarta.persistence.*;

/**
 * UserIdentityEntity - v1.2.0 JPA entity of "users_identities" (Flyway V1.2.0): one login provider
 * of a user with the profile refreshed at every login; the email is the key and never changes.
 */
@Entity
@Table(name = "users_identities")
public class UserIdentityEntity extends BaseAuthEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "id_user", nullable = false)
    private Long idUser;

    @Column(nullable = false)
    private String provider;

    @Column(name = "provider_subject", nullable = false)
    private String providerSubject;

    private String email;

    @Column(name = "profile_name")
    private String profileName;

    @Column(name = "given_name")
    private String givenName;

    @Column(name = "family_name")
    private String familyName;

    @Column(name = "picture_url")
    private String pictureUrl;

    private String locale;

    @Column(name = "ts_profile_update")
    private String tsProfileUpdate;

    @PrePersist
    protected void onCreate() {
        String now = java.time.Instant.now().toString();
        if (getUuid() == null) setUuid(java.util.UUID.randomUUID().toString());
        if (getTsInsert() == null) setTsInsert(now);
        if (getTsUpdate() == null) setTsUpdate(now);
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getIdUser() { return idUser; }
    public void setIdUser(Long idUser) { this.idUser = idUser; }
    public String getProvider() { return provider; }
    public void setProvider(String provider) { this.provider = provider; }
    public String getProviderSubject() { return providerSubject; }
    public void setProviderSubject(String providerSubject) { this.providerSubject = providerSubject; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getProfileName() { return profileName; }
    public void setProfileName(String profileName) { this.profileName = profileName; }
    public String getGivenName() { return givenName; }
    public void setGivenName(String givenName) { this.givenName = givenName; }
    public String getFamilyName() { return familyName; }
    public void setFamilyName(String familyName) { this.familyName = familyName; }
    public String getPictureUrl() { return pictureUrl; }
    public void setPictureUrl(String pictureUrl) { this.pictureUrl = pictureUrl; }
    public String getLocale() { return locale; }
    public void setLocale(String locale) { this.locale = locale; }
    public String getTsProfileUpdate() { return tsProfileUpdate; }
    public void setTsProfileUpdate(String tsProfileUpdate) { this.tsProfileUpdate = tsProfileUpdate; }

    @Override
    public String toString() {
        return "UserIdentityEntity{id=" + id + ", idUser=" + idUser + ", provider='" + provider + "'}";
    }
}
