## Checklist de seguridad básico

  - [ ] RLS: Row Level Security habilitado en ambas tablas: `games` y `scores`
  - [ ] Minimum password length — mínimo 8 caracteres
  - [ ] Leaked password protection — (el warning 4)
  - [ ] Max signup rate — limitar signups por IP (anti-bot)
  - [ ] Headers de seguridad en Next.js
  
  Ej:

```ts
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
];

// En la config de Next.js:
headers: async () => [
  { source: '/(.*)', headers: securityHeaders }
]
```

## Por el ladod e Supabase:

- [ ] TODO: vayan al panel de warnings y errores de Supabase


| name                            | title                               | level | facing   | categories   | description                                       | detail                                                                                                                                   | remediation                                                                                              | metadata                        | cache_key                       |
| ------------------------------- | ----------------------------------- | ----- | -------- | ------------ | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------- | ------------------------------- |
| auth_leaked_password_protection | Leaked Password Protection Disabled | WARN  | EXTERNAL | ["SECURITY"] | Leaked password protection is currently disabled. | Supabase Auth prevents the use of compromised passwords by checking against HaveIBeenPwned.org. Enable this feature to enhance security. | https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection | {"entity":"Auth","type":"auth"} | auth_leaked_password_protection |