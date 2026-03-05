# Stage 1: Build with Maven
FROM maven:3.9-eclipse-temurin-21 AS builder
WORKDIR /app
COPY pom.xml .
COPY core/pom.xml core/
COPY adapter-rest/pom.xml adapter-rest/
COPY adapter-auth/pom.xml adapter-auth/
COPY adapter-admin/pom.xml adapter-admin/
COPY adapter-websocket/pom.xml adapter-websocket/
COPY adapter-postgres/pom.xml adapter-postgres/
COPY adapter-sqlite/pom.xml adapter-sqlite/
COPY adapter-mongo/pom.xml adapter-mongo/
COPY adapter-kafka/pom.xml adapter-kafka/
COPY ms-launcher/pom.xml ms-launcher/
RUN mvn dependency:go-offline -B
COPY . .
RUN mvn clean package -DskipTests -B

# Stage 2: Minimal runtime image
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=builder /app/ms-launcher/target/*.jar app.jar
EXPOSE 8080
ENV SPRING_PROFILES_ACTIVE=prod
ENTRYPOINT ["java", "-jar", "app.jar"]
