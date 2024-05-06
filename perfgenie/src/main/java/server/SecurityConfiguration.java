package server;

import org.springframework.context.annotation.Bean;
import org.springframework.security.config.annotation.authentication.builders.AuthenticationManagerBuilder;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configuration.WebSecurityConfigurerAdapter;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.io.BufferedReader;
import java.io.FileReader;
import java.io.IOException;

@EnableWebSecurity
public class SecurityConfiguration extends WebSecurityConfigurerAdapter {

    private PasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    @Override
    protected void configure(AuthenticationManagerBuilder auth) throws Exception {
        String fileName = System.getProperty("user.home") + "/credentials.txt";
        String[] credentials = readCredentialsFromFile(fileName);
        auth.inMemoryAuthentication()
                .passwordEncoder(passwordEncoder())
                .withUser(credentials[0])
                .password(passwordEncoder().encode(credentials[1]))
                .roles("USER");
    }
    public static String[] readCredentialsFromFile(String fileName) throws IOException {
        BufferedReader reader = new BufferedReader(new FileReader(fileName));
        String line = reader.readLine();
        reader.close();
        return line.split(","); // Assuming the line contains comma-separated user ID and password
    }
    @Bean
    public PasswordEncoder passwordEncoder() {
        return passwordEncoder;
    }
}