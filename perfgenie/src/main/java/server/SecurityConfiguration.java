package server;

import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.authentication.builders.AuthenticationManagerBuilder;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.builders.WebSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configuration.WebSecurityConfigurerAdapter;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.io.BufferedReader;
import java.io.FileReader;
import java.io.IOException;
@Configuration
@EnableWebSecurity
public class SecurityConfiguration extends WebSecurityConfigurerAdapter {
    private final org.slf4j.Logger  logger =  LoggerFactory.getLogger(SecurityConfiguration.class);
    private PasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    @Override
    public void configure(WebSecurity web) throws Exception {
        String substrate = System.getenv("SUBSTRATE");
        if(substrate == null) {
            logger.info("Using authentication");
            web.ignoring()
                    .antMatchers("test/test");
        } else {
            logger.info("Skipping authentication for substrate" + substrate);
            web.ignoring()
                    .antMatchers("/**");
        }
    }

    @Autowired
    public void configureGlobal(AuthenticationManagerBuilder auth) throws Exception {
        String fileName = System.getProperty("user.home") + "/credentials.txt";
        String[] credentials = readCredentialsFromFile(fileName);
        auth.inMemoryAuthentication()
                .passwordEncoder(passwordEncoder())
                .withUser(credentials[0])
                .password(passwordEncoder().encode(credentials[1]))
                .roles("USER");
    }

    public static String[] readCredentialsFromFile(String fileName) throws IOException {
        try {
            BufferedReader reader = new BufferedReader(new FileReader(fileName));
            String line = reader.readLine();
            reader.close();
            return line.split(","); // Assuming the line contains comma-separated user ID and password
        }catch(Exception e){
            return "dev-user,DevUser".split(",");
        }
    }
    @Bean
    public PasswordEncoder passwordEncoder() {
        return passwordEncoder;
    }
}