const translations = {
  en: {
    _page_title: "FollowAudit — See who doesn't follow you back, privately",
    _meta: "Free, open-source tool to see who doesn't follow you back and who unfollowed you on Instagram and TikTok. Runs entirely in your browser.",
    skip: 'Skip to content',
    primary_nav: 'Primary navigation',
    nav_features: 'Features',
    nav_how: 'How to run',
    nav_privacy: 'Privacy',
    nav_faq: 'FAQ',
    language_label: 'Language',
    theme_dark: 'Switch to dark mode',
    theme_light: 'Switch to light mode',
    github: 'FollowAudit on GitHub',
    copy_script: 'Copy script',
    copy_short: 'Copy',
    side_following: 'Following',
    side_followers: 'Followers',
    tag_not_back: "doesn't follow back",
    tag_you_not_back: "you don't follow back",
    sample_caption: 'Sample accounts. Your real lists never leave your browser.',
    hero_title: "See who doesn't follow you back — and who unfollowed you.",
    hero_body: 'FollowAudit compares both sides of your Instagram or TikTok in one audit, keeps the people who matter protected, and changes nothing until you confirm. It runs entirely in your browser.',
    live_preview: 'Try the live preview',
    venue_browser: 'Desktop browser',
    box_preview: 'The panel',
    shot_report_alt: 'FollowAudit side panel showing the account report',
    box_preview_body: "Docked beside Instagram, it opens as a report: both counts, who doesn't follow back, and who left since last time.",
    box_card: 'The undercard',
    b1_a: 'Following', b1_b: 'Followers', b1_body: 'One audit loads both lists once and matches every account.',
    b2_a: 'Today', b2_b: 'Last audit', b2_body: 'See exactly who unfollowed you since the previous audit.',
    b3_a: 'Friends', b3_b: 'The queue', b3_body: 'Protected accounts never enter an action queue. Back up the list as a file.',
    b4_a: 'Speed', b4_b: 'Safety', b4_body: 'One action at a time, with pauses and time left, stopping by itself if Instagram pushes back.',
    b5_a: 'Instagram', b5_b: 'TikTok', b5_body: 'A live audit on Instagram; the official data export, read-only, on TikTok.',
    box_run: 'How to run it',
    r1: 'Copy the script',
    r2: 'Open Instagram or TikTok on a computer',
    r2_key: 'Desktop',
    r3: 'Open the browser console',
    r4: 'Paste and press Enter',
    r5: 'Run the audit and review',
    r5_key: 'Your call',
    run_tip: 'On a Mac, open the console with Cmd + Option + J and paste with Cmd + V. Chrome may ask you to type “allow pasting” the first time.',
    band_label: 'Guarantees',
    g1_title: 'No password', g1_body: 'It uses the Instagram tab you already have open.',
    g2_title: 'No server', g2_body: 'No backend, no analytics, nothing uploaded.',
    g3_title: 'Protected stays protected', g3_body: 'Marked accounts are never touched.',
    g4_title: 'Open source', g4_body: 'MIT licensed. Read every line before you run it.',
    privacy_title: 'Your lists stay in your tab.\nYour decisions stay yours.',
    privacy_body: 'FollowAudit reads your lists from your own logged-in session and keeps them in memory. The only things it saves, in your browser, are the accounts you protect and your last follower list, so it can tell you who left. Clear both at any time in Settings.',
    notice: 'FollowAudit is not affiliated with Instagram, Meta, TikTok or ByteDance. Instagram support uses private web endpoints that can change without notice, and heavy activity can trigger platform limits.',
    faq_title: 'Questions before the bell',
    q1: 'Is FollowAudit safe to use?',
    a1: 'The script talks only to Instagram, from your own logged-in tab, and never to a third-party server. It reads lists page by page, never retries an unfollow, pauses between actions and stops as soon as Instagram refuses a request.',
    q2: 'Does it need my password?',
    a2: 'No. It runs inside the Instagram tab you already have open and uses that session.',
    q3: 'Why do I paste it into the console?',
    a3: 'Running inside the page is what keeps it private: no extension permissions, no app login, no server in the middle. You can read the full source on GitHub before running it.',
    q4: 'How does “who unfollowed you” work?',
    a4: 'After each audit, FollowAudit saves follower IDs and usernames in your browser. The next audit compares against them. You can clear this history at any time in Settings.',
    q5: 'Can I use it on my phone?',
    a5: 'Not yet. Mobile browsers do not offer a developer console, so you need a desktop browser.',
    q6: 'Is it free?',
    a6: 'Yes. FollowAudit is free and open source under the MIT license.',
    cta_title: 'Both sides of your follows, in one audit.',
    view_source: 'View source on GitHub',
    footer_note: 'Built for deliberate decisions. Your data stays yours.',
    footer_nav: 'Footer navigation',
    changelog: 'Changelog',
    security: 'Security',
    license: 'MIT License',
    copying: 'Copying…',
    copied: 'Copied!',
    copy_success: 'Script copied. Open Instagram or TikTok, open the Console and paste it.',
    copy_error: 'Automatic copy failed. Download dist.js from GitHub instead.',
  },
  'pt-BR': {
    _page_title: 'FollowAudit — Veja quem não segue você de volta, com privacidade',
    _meta: 'Ferramenta gratuita e open source para ver quem não segue você de volta e quem deixou de seguir no Instagram e no TikTok. Roda inteiramente no seu navegador.',
    skip: 'Pular para o conteúdo',
    primary_nav: 'Navegação principal',
    nav_features: 'Recursos',
    nav_how: 'Como usar',
    nav_privacy: 'Privacidade',
    nav_faq: 'Dúvidas',
    language_label: 'Idioma',
    theme_dark: 'Mudar para o modo escuro',
    theme_light: 'Mudar para o modo claro',
    github: 'FollowAudit no GitHub',
    copy_script: 'Copiar script',
    copy_short: 'Copiar',
    side_following: 'Seguindo',
    side_followers: 'Seguidores',
    tag_not_back: 'não segue de volta',
    tag_you_not_back: 'você não segue de volta',
    sample_caption: 'Contas de exemplo. Suas listas reais nunca saem do seu navegador.',
    hero_title: 'Veja quem não segue você de volta — e quem deixou de seguir.',
    hero_body: 'O FollowAudit compara os dois lados do seu Instagram ou TikTok em uma auditoria, mantém protegidas as pessoas que importam e não muda nada até você confirmar. Tudo roda no seu navegador.',
    live_preview: 'Ver demonstração',
    venue_browser: 'Navegador no computador',
    box_preview: 'O painel',
    shot_report_alt: 'Painel lateral do FollowAudit mostrando o relatório da conta',
    box_preview_body: 'Ao lado do Instagram, ele abre como um relatório: as duas contagens, quem não segue de volta e quem saiu desde a última vez.',
    box_card: 'O card da noite',
    b1_a: 'Seguindo', b1_b: 'Seguidores', b1_body: 'Uma auditoria carrega as duas listas uma vez e cruza todas as contas.',
    b2_a: 'Hoje', b2_b: 'Última auditoria', b2_body: 'Veja exatamente quem deixou de seguir você desde a auditoria anterior.',
    b3_a: 'Amigos', b3_b: 'A fila', b3_body: 'Contas protegidas nunca entram numa fila de ações. Faça backup da lista em um arquivo.',
    b4_a: 'Velocidade', b4_b: 'Segurança', b4_body: 'Uma ação por vez, com pausas e tempo restante, parando sozinha se o Instagram reagir.',
    b5_a: 'Instagram', b5_b: 'TikTok', b5_body: 'Auditoria ao vivo no Instagram; no TikTok, a exportação oficial de dados, só leitura.',
    box_run: 'Como usar',
    r1: 'Copie o script',
    r2: 'Abra o Instagram ou o TikTok no computador',
    r2_key: 'Computador',
    r3: 'Abra o console do navegador',
    r4: 'Cole e pressione Enter',
    r5: 'Rode a auditoria e revise',
    r5_key: 'Você decide',
    run_tip: 'No Mac, abra o console com Cmd + Option + J e cole com Cmd + V. Na primeira vez, o Chrome pode pedir que você digite “allow pasting”.',
    band_label: 'Garantias',
    g1_title: 'Sem senha', g1_body: 'Usa a aba do Instagram que você já tem aberta.',
    g2_title: 'Sem servidor', g2_body: 'Sem backend, sem análises, nada enviado.',
    g3_title: 'Protegido continua protegido', g3_body: 'Contas marcadas nunca são alteradas.',
    g4_title: 'Open source', g4_body: 'Licença MIT. Leia cada linha antes de executar.',
    privacy_title: 'Suas listas ficam na sua aba.\nSuas decisões continuam suas.',
    privacy_body: 'O FollowAudit lê suas listas a partir da sua própria sessão e as mantém só na memória. As únicas coisas que ele salva, no seu navegador, são as contas que você protege e sua última lista de seguidores, para mostrar quem saiu. Limpe as duas quando quiser em Configurações.',
    notice: 'O FollowAudit não é afiliado ao Instagram, Meta, TikTok ou ByteDance. O suporte ao Instagram usa endpoints web privados que podem mudar sem aviso, e atividade intensa pode acionar limites da plataforma.',
    faq_title: 'Perguntas antes do gongo',
    q1: 'O FollowAudit é seguro?',
    a1: 'O script conversa apenas com o Instagram, a partir da sua própria aba logada, e nunca com um servidor de terceiros. Ele lê as listas página por página, nunca repete um unfollow, pausa entre ações e para assim que o Instagram recusa uma solicitação.',
    q2: 'Ele precisa da minha senha?',
    a2: 'Não. Ele roda dentro da aba do Instagram que você já tem aberta e usa essa sessão.',
    q3: 'Por que colar no console?',
    a3: 'Rodar dentro da página é o que garante a privacidade: sem permissões de extensão, sem login em app, sem servidor no meio. Você pode ler todo o código no GitHub antes de executar.',
    q4: 'Como funciona o “quem deixou de seguir você”?',
    a4: 'Após cada auditoria, o FollowAudit salva IDs e nomes de usuário dos seguidores no seu navegador. A próxima auditoria compara com eles. Você pode limpar esse histórico quando quiser em Configurações.',
    q5: 'Posso usar no celular?',
    a5: 'Ainda não. Navegadores de celular não oferecem console de desenvolvedor, então você precisa de um navegador de computador.',
    q6: 'É gratuito?',
    a6: 'Sim. O FollowAudit é gratuito e open source sob a licença MIT.',
    cta_title: 'Os dois lados dos seus follows, em uma auditoria.',
    view_source: 'Ver código no GitHub',
    footer_note: 'Feito para decisões conscientes. Seus dados continuam seus.',
    footer_nav: 'Navegação do rodapé',
    changelog: 'Novidades',
    security: 'Segurança',
    license: 'Licença MIT',
    copying: 'Copiando…',
    copied: 'Copiado!',
    copy_success: 'Script copiado. Abra o Instagram ou o TikTok, abra o Console e cole.',
    copy_error: 'A cópia automática falhou. Baixe o dist.js no GitHub.',
  },
  es: {
    _page_title: 'FollowAudit — Descubre quién no te sigue de vuelta, con privacidad',
    _meta: 'Herramienta gratuita y de código abierto para ver quién no te sigue de vuelta y quién dejó de seguirte en Instagram y TikTok. Funciona por completo en tu navegador.',
    skip: 'Saltar al contenido',
    primary_nav: 'Navegación principal',
    nav_features: 'Funciones',
    nav_how: 'Cómo usarlo',
    nav_privacy: 'Privacidad',
    nav_faq: 'Preguntas',
    language_label: 'Idioma',
    theme_dark: 'Cambiar al modo oscuro',
    theme_light: 'Cambiar al modo claro',
    github: 'FollowAudit en GitHub',
    copy_script: 'Copiar script',
    copy_short: 'Copiar',
    side_following: 'Siguiendo',
    side_followers: 'Seguidores',
    tag_not_back: 'no te sigue',
    tag_you_not_back: 'no lo sigues',
    sample_caption: 'Cuentas de ejemplo. Tus listas reales nunca salen de tu navegador.',
    hero_title: 'Descubre quién no te sigue de vuelta — y quién dejó de seguirte.',
    hero_body: 'FollowAudit compara ambos lados de tu Instagram o TikTok en una auditoría, mantiene protegidas a las personas que importan y no cambia nada hasta que confirmes. Funciona por completo en tu navegador.',
    live_preview: 'Probar la demo',
    venue_browser: 'Navegador de escritorio',
    box_preview: 'El panel',
    shot_report_alt: 'Panel lateral de FollowAudit con el informe de la cuenta',
    box_preview_body: 'Junto a Instagram, se abre como un informe: ambos totales, quién no te sigue de vuelta y quién se fue desde la última vez.',
    box_card: 'La cartelera',
    b1_a: 'Siguiendo', b1_b: 'Seguidores', b1_body: 'Una auditoría carga ambas listas una sola vez y cruza todas las cuentas.',
    b2_a: 'Hoy', b2_b: 'Última auditoría', b2_body: 'Mira exactamente quién dejó de seguirte desde la auditoría anterior.',
    b3_a: 'Amigos', b3_b: 'La cola', b3_body: 'Las cuentas protegidas nunca entran en una cola de acciones. Respalda la lista en un archivo.',
    b4_a: 'Velocidad', b4_b: 'Seguridad', b4_body: 'Una acción a la vez, con pausas y tiempo restante, deteniéndose sola si Instagram se resiste.',
    b5_a: 'Instagram', b5_b: 'TikTok', b5_body: 'Auditoría en vivo en Instagram; en TikTok, la exportación oficial de datos, solo lectura.',
    box_run: 'Cómo usarlo',
    r1: 'Copia el script',
    r2: 'Abre Instagram o TikTok en un ordenador',
    r2_key: 'Escritorio',
    r3: 'Abre la consola del navegador',
    r4: 'Pega y pulsa Enter',
    r5: 'Ejecuta la auditoría y revisa',
    r5_key: 'Tú decides',
    run_tip: 'En Mac, abre la consola con Cmd + Option + J y pega con Cmd + V. La primera vez, Chrome puede pedirte que escribas “allow pasting”.',
    band_label: 'Garantías',
    g1_title: 'Sin contraseña', g1_body: 'Usa la pestaña de Instagram que ya tienes abierta.',
    g2_title: 'Sin servidor', g2_body: 'Sin backend, sin analíticas, nada se sube.',
    g3_title: 'Lo protegido sigue protegido', g3_body: 'Las cuentas marcadas nunca se tocan.',
    g4_title: 'Código abierto', g4_body: 'Licencia MIT. Lee cada línea antes de ejecutarlo.',
    privacy_title: 'Tus listas se quedan en tu pestaña.\nTus decisiones siguen siendo tuyas.',
    privacy_body: 'FollowAudit lee tus listas desde tu propia sesión y las mantiene en memoria. Lo único que guarda, en tu navegador, son las cuentas que proteges y tu última lista de seguidores, para decirte quién se fue. Borra ambas cuando quieras en Ajustes.',
    notice: 'FollowAudit no está afiliado a Instagram, Meta, TikTok ni ByteDance. El soporte de Instagram usa endpoints web privados que pueden cambiar sin aviso, y la actividad intensa puede activar límites de la plataforma.',
    faq_title: 'Preguntas antes de la campana',
    q1: '¿Es seguro usar FollowAudit?',
    a1: 'El script solo habla con Instagram, desde tu propia pestaña con sesión iniciada, y nunca con un servidor de terceros. Lee las listas página por página, nunca repite un unfollow, hace pausas entre acciones y se detiene en cuanto Instagram rechaza una solicitud.',
    q2: '¿Necesita mi contraseña?',
    a2: 'No. Funciona dentro de la pestaña de Instagram que ya tienes abierta y usa esa sesión.',
    q3: '¿Por qué pegarlo en la consola?',
    a3: 'Ejecutarse dentro de la página es lo que lo mantiene privado: sin permisos de extensión, sin inicio de sesión en apps, sin servidores intermedios. Puedes leer todo el código en GitHub antes de ejecutarlo.',
    q4: '¿Cómo funciona “quién dejó de seguirte”?',
    a4: 'Tras cada auditoría, FollowAudit guarda los IDs y nombres de usuario de tus seguidores en tu navegador. La siguiente auditoría los compara. Puedes borrar este historial cuando quieras en Ajustes.',
    q5: '¿Puedo usarlo en el móvil?',
    a5: 'Todavía no. Los navegadores móviles no ofrecen consola de desarrollador, así que necesitas un navegador de escritorio.',
    q6: '¿Es gratis?',
    a6: 'Sí. FollowAudit es gratuito y de código abierto bajo la licencia MIT.',
    cta_title: 'Ambos lados de tus follows, en una auditoría.',
    view_source: 'Ver el código en GitHub',
    footer_note: 'Hecho para decisiones deliberadas. Tus datos siguen siendo tuyos.',
    footer_nav: 'Navegación del pie de página',
    changelog: 'Novedades',
    security: 'Seguridad',
    license: 'Licencia MIT',
    copying: 'Copiando…',
    copied: '¡Copiado!',
    copy_success: 'Script copiado. Abre Instagram o TikTok, abre la Consola y pégalo.',
    copy_error: 'La copia automática falló. Descarga dist.js desde GitHub.',
  },
  fr: {
    _page_title: 'FollowAudit — Voyez qui ne vous suit pas en retour, en toute confidentialité',
    _meta: 'Outil gratuit et open source pour voir qui ne vous suit pas en retour et qui a cessé de vous suivre sur Instagram et TikTok. Fonctionne entièrement dans votre navigateur.',
    skip: 'Aller au contenu',
    primary_nav: 'Navigation principale',
    nav_features: 'Fonctionnalités',
    nav_how: 'Utilisation',
    nav_privacy: 'Confidentialité',
    nav_faq: 'FAQ',
    language_label: 'Langue',
    theme_dark: 'Passer au mode sombre',
    theme_light: 'Passer au mode clair',
    github: 'FollowAudit sur GitHub',
    copy_script: 'Copier le script',
    copy_short: 'Copier',
    side_following: 'Abonnements',
    side_followers: 'Abonnés',
    tag_not_back: 'ne vous suit pas',
    tag_you_not_back: 'vous ne suivez pas',
    sample_caption: 'Comptes fictifs. Vos vraies listes ne quittent jamais votre navigateur.',
    hero_title: 'Voyez qui ne vous suit pas en retour — et qui a cessé de vous suivre.',
    hero_body: 'FollowAudit compare les deux côtés de votre Instagram ou TikTok en un seul audit, protège les personnes qui comptent et ne change rien sans votre confirmation. Tout se passe dans votre navigateur.',
    live_preview: 'Essayer la démo',
    venue_browser: 'Navigateur sur ordinateur',
    box_preview: 'Le panneau',
    shot_report_alt: 'Panneau latéral de FollowAudit affichant le rapport du compte',
    box_preview_body: 'Ancré à côté d’Instagram, il s’ouvre comme un rapport : les deux totaux, qui ne vous suit pas en retour et qui est parti depuis la dernière fois.',
    box_card: 'Le programme',
    b1_a: 'Abonnements', b1_b: 'Abonnés', b1_body: 'Un audit charge les deux listes une seule fois et croise chaque compte.',
    b2_a: 'Aujourd’hui', b2_b: 'Dernier audit', b2_body: 'Voyez exactement qui a cessé de vous suivre depuis l’audit précédent.',
    b3_a: 'Amis', b3_b: 'La file', b3_body: 'Les comptes protégés n’entrent jamais dans une file d’actions. Sauvegardez la liste dans un fichier.',
    b4_a: 'Vitesse', b4_b: 'Sécurité', b4_body: 'Une action à la fois, avec pauses et temps restant, qui s’arrête seule si Instagram résiste.',
    b5_a: 'Instagram', b5_b: 'TikTok', b5_body: 'Un audit en direct sur Instagram ; sur TikTok, l’export officiel des données, en lecture seule.',
    box_run: 'Mode d’emploi',
    r1: 'Copiez le script',
    r2: 'Ouvrez Instagram ou TikTok sur ordinateur',
    r2_key: 'Ordinateur',
    r3: 'Ouvrez la console du navigateur',
    r4: 'Collez et appuyez sur Entrée',
    r5: 'Lancez l’audit et examinez',
    r5_key: 'À vous',
    run_tip: 'Sur Mac, ouvrez la console avec Cmd + Option + J et collez avec Cmd + V. La première fois, Chrome peut vous demander de taper « allow pasting ».',
    band_label: 'Garanties',
    g1_title: 'Sans mot de passe', g1_body: 'Il utilise l’onglet Instagram déjà ouvert.',
    g2_title: 'Sans serveur', g2_body: 'Ni backend, ni statistiques, rien n’est envoyé.',
    g3_title: 'Protégé reste protégé', g3_body: 'Les comptes marqués ne sont jamais modifiés.',
    g4_title: 'Open source', g4_body: 'Licence MIT. Lisez chaque ligne avant de l’exécuter.',
    privacy_title: 'Vos listes restent dans votre onglet.\nVos décisions restent les vôtres.',
    privacy_body: 'FollowAudit lit vos listes depuis votre propre session et les garde en mémoire. Les seules choses qu’il enregistre, dans votre navigateur, sont les comptes protégés et votre dernière liste d’abonnés, pour vous dire qui est parti. Effacez-les à tout moment dans les Réglages.',
    notice: 'FollowAudit n’est affilié ni à Instagram, ni à Meta, ni à TikTok, ni à ByteDance. Le support d’Instagram utilise des points d’accès web privés susceptibles de changer sans préavis, et une activité intense peut déclencher des limites.',
    faq_title: 'Questions avant le gong',
    q1: 'FollowAudit est-il sûr ?',
    a1: 'Le script ne communique qu’avec Instagram, depuis votre propre onglet connecté, et jamais avec un serveur tiers. Il lit les listes page par page, ne réessaie jamais un désabonnement, marque des pauses entre les actions et s’arrête dès qu’Instagram refuse une requête.',
    q2: 'A-t-il besoin de mon mot de passe ?',
    a2: 'Non. Il s’exécute dans l’onglet Instagram déjà ouvert et utilise cette session.',
    q3: 'Pourquoi le coller dans la console ?',
    a3: 'S’exécuter dans la page est ce qui le rend privé : aucune permission d’extension, aucune connexion à une app, aucun serveur intermédiaire. Vous pouvez lire tout le code sur GitHub avant de l’exécuter.',
    q4: 'Comment fonctionne « qui a cessé de vous suivre » ?',
    a4: 'Après chaque audit, FollowAudit enregistre les identifiants et noms d’utilisateur de vos abonnés dans votre navigateur. L’audit suivant les compare. Vous pouvez effacer cet historique à tout moment dans les Réglages.',
    q5: 'Puis-je l’utiliser sur mon téléphone ?',
    a5: 'Pas encore. Les navigateurs mobiles n’offrent pas de console de développement ; il vous faut un navigateur sur ordinateur.',
    q6: 'Est-ce gratuit ?',
    a6: 'Oui. FollowAudit est gratuit et open source sous licence MIT.',
    cta_title: 'Les deux côtés de vos abonnements, en un audit.',
    view_source: 'Voir le code sur GitHub',
    footer_note: 'Conçu pour des décisions réfléchies. Vos données restent les vôtres.',
    footer_nav: 'Navigation du pied de page',
    changelog: 'Nouveautés',
    security: 'Sécurité',
    license: 'Licence MIT',
    copying: 'Copie…',
    copied: 'Copié !',
    copy_success: 'Script copié. Ouvrez Instagram ou TikTok, ouvrez la Console et collez-le.',
    copy_error: 'La copie automatique a échoué. Téléchargez dist.js depuis GitHub.',
  },
  de: {
    _page_title: 'FollowAudit — Sieh privat, wer dir nicht zurückfolgt',
    _meta: 'Kostenloses Open-Source-Tool, das zeigt, wer dir auf Instagram und TikTok nicht zurückfolgt und wer dir entfolgt ist. Läuft komplett in deinem Browser.',
    skip: 'Zum Inhalt springen',
    primary_nav: 'Hauptnavigation',
    nav_features: 'Funktionen',
    nav_how: 'Anleitung',
    nav_privacy: 'Datenschutz',
    nav_faq: 'FAQ',
    language_label: 'Sprache',
    theme_dark: 'Zum dunklen Modus wechseln',
    theme_light: 'Zum hellen Modus wechseln',
    github: 'FollowAudit auf GitHub',
    copy_script: 'Skript kopieren',
    copy_short: 'Kopieren',
    side_following: 'Gefolgt',
    side_followers: 'Follower',
    tag_not_back: 'folgt nicht zurück',
    tag_you_not_back: 'du folgst nicht zurück',
    sample_caption: 'Beispielkonten. Deine echten Listen verlassen nie deinen Browser.',
    hero_title: 'Sieh, wer dir nicht zurückfolgt — und wer dir entfolgt ist.',
    hero_body: 'FollowAudit vergleicht beide Seiten deines Instagram- oder TikTok-Kontos in einer Prüfung, schützt die Menschen, die dir wichtig sind, und ändert nichts ohne deine Bestätigung. Alles läuft in deinem Browser.',
    live_preview: 'Live-Demo ansehen',
    venue_browser: 'Desktop-Browser',
    box_preview: 'Das Panel',
    shot_report_alt: 'Seitenpanel von FollowAudit mit dem Kontobericht',
    box_preview_body: 'Neben Instagram angedockt, öffnet es sich als Bericht: beide Zahlen, wer nicht zurückfolgt und wer seit dem letzten Mal gegangen ist.',
    box_card: 'Das Rahmenprogramm',
    b1_a: 'Gefolgt', b1_b: 'Follower', b1_body: 'Eine Prüfung lädt beide Listen einmal und gleicht jedes Konto ab.',
    b2_a: 'Heute', b2_b: 'Letzte Prüfung', b2_body: 'Sieh genau, wer dir seit der vorherigen Prüfung entfolgt ist.',
    b3_a: 'Freunde', b3_b: 'Warteschlange', b3_body: 'Geschützte Konten landen nie in einer Aktionswarteschlange. Sichere die Liste als Datei.',
    b4_a: 'Tempo', b4_b: 'Sicherheit', b4_body: 'Eine Aktion nach der anderen, mit Pausen und Restzeit, die von selbst stoppt, wenn Instagram blockt.',
    b5_a: 'Instagram', b5_b: 'TikTok', b5_body: 'Eine Live-Prüfung auf Instagram; auf TikTok der offizielle Datenexport, nur lesend.',
    box_run: 'So geht’s',
    r1: 'Skript kopieren',
    r2: 'Instagram oder TikTok am Computer öffnen',
    r2_key: 'Desktop',
    r3: 'Browser-Konsole öffnen',
    r4: 'Einfügen und Enter drücken',
    r5: 'Prüfung starten und entscheiden',
    r5_key: 'Deine Wahl',
    run_tip: 'Am Mac öffnest du die Konsole mit Cmd + Option + J und fügst mit Cmd + V ein. Beim ersten Mal verlangt Chrome eventuell, dass du „allow pasting“ eingibst.',
    band_label: 'Garantien',
    g1_title: 'Kein Passwort', g1_body: 'Es nutzt den Instagram-Tab, den du schon offen hast.',
    g2_title: 'Kein Server', g2_body: 'Kein Backend, keine Analysen, nichts wird hochgeladen.',
    g3_title: 'Geschützt bleibt geschützt', g3_body: 'Markierte Konten werden nie angerührt.',
    g4_title: 'Open Source', g4_body: 'MIT-Lizenz. Lies jede Zeile, bevor du es ausführst.',
    privacy_title: 'Deine Listen bleiben in deinem Tab.\nDeine Entscheidungen bleiben deine.',
    privacy_body: 'FollowAudit liest deine Listen aus deiner eigenen Sitzung und hält sie im Speicher. Gespeichert werden in deinem Browser nur die geschützten Konten und deine letzte Followerliste, damit es dir zeigen kann, wer gegangen ist. Lösche beides jederzeit in den Einstellungen.',
    notice: 'FollowAudit ist nicht mit Instagram, Meta, TikTok oder ByteDance verbunden. Die Instagram-Unterstützung nutzt private Web-Endpunkte, die sich ohne Vorankündigung ändern können, und intensive Aktivität kann Plattformlimits auslösen.',
    faq_title: 'Fragen vor dem Gong',
    q1: 'Ist FollowAudit sicher?',
    a1: 'Das Skript kommuniziert nur mit Instagram – aus deinem eigenen angemeldeten Tab – und nie mit einem fremden Server. Es lädt Listen seitenweise, wiederholt nie ein Entfolgen, pausiert zwischen Aktionen und stoppt, sobald Instagram eine Anfrage ablehnt.',
    q2: 'Braucht es mein Passwort?',
    a2: 'Nein. Es läuft im bereits geöffneten Instagram-Tab und nutzt diese Sitzung.',
    q3: 'Warum füge ich es in die Konsole ein?',
    a3: 'Die Ausführung in der Seite hält alles privat: keine Erweiterungsrechte, kein App-Login, kein Server dazwischen. Du kannst den gesamten Code vorher auf GitHub lesen.',
    q4: 'Wie funktioniert „Wer dir entfolgt ist“?',
    a4: 'Nach jeder Prüfung speichert FollowAudit IDs und Benutzernamen deiner Follower in deinem Browser. Die nächste Prüfung vergleicht damit. Du kannst diesen Verlauf jederzeit in den Einstellungen löschen.',
    q5: 'Kann ich es auf dem Handy nutzen?',
    a5: 'Noch nicht. Mobile Browser bieten keine Entwicklerkonsole, daher brauchst du einen Desktop-Browser.',
    q6: 'Ist es kostenlos?',
    a6: 'Ja. FollowAudit ist kostenlos und Open Source unter der MIT-Lizenz.',
    cta_title: 'Beide Seiten deiner Follows, in einer Prüfung.',
    view_source: 'Code auf GitHub ansehen',
    footer_note: 'Gemacht für bewusste Entscheidungen. Deine Daten bleiben deine.',
    footer_nav: 'Fußzeilennavigation',
    changelog: 'Änderungen',
    security: 'Sicherheit',
    license: 'MIT-Lizenz',
    copying: 'Wird kopiert…',
    copied: 'Kopiert!',
    copy_success: 'Skript kopiert. Öffne Instagram oder TikTok, öffne die Konsole und füge es ein.',
    copy_error: 'Automatisches Kopieren fehlgeschlagen. Lade dist.js stattdessen von GitHub herunter.',
  },
};

const LANGUAGE_KEY = 'follow-audit:site-language';
const THEME_KEY = 'follow-audit:site-theme';
const root = document.documentElement;
const languageMenu = document.querySelector('#language-menu');
const languageSummary = languageMenu.querySelector('summary');
const activeLanguageLabel = document.querySelector('[data-active-language]');
const languageButtons = [...document.querySelectorAll('[data-language]')];
const themeToggle = document.querySelector('#theme-toggle');
const copyButtons = [...document.querySelectorAll('.copy-script')];
const feedbackElements = [...document.querySelectorAll('.copy-feedback')];
const contenders = [...document.querySelectorAll('.contender')];
const description = document.querySelector('meta[name="description"]');
const storage = {
  get(key) {
    try { return localStorage.getItem(key); } catch { return null; }
  },
  set(key, value) {
    try { localStorage.setItem(key, value); } catch { /* Preferences stay session-only. */ }
  },
};

let activeLanguage = initialLanguage();
let resetTimer;

function initialLanguage() {
  const saved = storage.get(LANGUAGE_KEY);
  if (saved && translations[saved]) return saved;
  const browserLanguage = navigator.language.toLowerCase();
  if (browserLanguage.startsWith('pt')) return 'pt-BR';
  return Object.keys(translations).find((language) => browserLanguage.startsWith(language)) || 'en';
}

/** Sizes both contenders to the largest type that fits their halves, so the longer name sets the scale. */
function fitContenders() {
  root.style.removeProperty('--contender');
  const reference = 100;
  let scale = Infinity;
  for (const contender of contenders) {
    const label = contender.firstElementChild;
    label.style.fontSize = `${reference}px`;
    scale = Math.min(scale, contender.clientWidth / label.scrollWidth);
    label.style.removeProperty('font-size');
  }
  if (Number.isFinite(scale) && scale > 0) {
    root.style.setProperty('--contender', `${Math.max(16, Math.min(168, Math.floor(reference * scale * 0.98)))}px`);
  }
}

function applyLanguage(language) {
  activeLanguage = translations[language] ? language : 'en';
  const copy = translations[activeLanguage];
  root.lang = activeLanguage;
  document.title = copy._page_title;
  description.content = copy._meta;
  activeLanguageLabel.textContent = activeLanguage === 'pt-BR' ? 'PT' : activeLanguage.toUpperCase();
  languageSummary.setAttribute('aria-label', `${copy.language_label}: ${activeLanguageLabel.textContent}`);
  languageButtons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.language === activeLanguage)));
  document.querySelectorAll('[data-i18n]').forEach((element) => {
    const value = copy[element.dataset.i18n];
    if (value) element.textContent = value;
  });
  document.querySelectorAll('[data-i18n-aria-label]').forEach((element) => {
    const value = copy[element.dataset.i18nAriaLabel];
    if (value) element.setAttribute('aria-label', value);
  });
  document.querySelectorAll('[data-i18n-alt]').forEach((element) => {
    const value = copy[element.dataset.i18nAlt];
    if (value) element.alt = value;
  });
  updateThemeControl();
  fitContenders();
}

function updateThemeControl() {
  const isDark = root.dataset.theme === 'dark';
  themeToggle.setAttribute('aria-label', translations[activeLanguage][isDark ? 'theme_light' : 'theme_dark']);
  themeToggle.setAttribute('aria-pressed', String(isDark));
}

function showFeedback(key, tone = 'ok') {
  feedbackElements.forEach((element) => {
    element.dataset.tone = tone;
    element.textContent = translations[activeLanguage][key];
  });
}

function setCopyLabels(key) {
  copyButtons.forEach((button) => {
    const label = button.querySelector('[data-i18n]');
    label.textContent = translations[activeLanguage][key ?? label.dataset.i18n];
  });
}

async function copyScript() {
  clearTimeout(resetTimer);
  copyButtons.forEach((button) => { button.disabled = true; });
  setCopyLabels('copying');
  try {
    const bundle = fetch(`dist.js?v=${Date.now()}`, { cache: 'no-store' }).then(async (response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const script = await response.text();
      if (script.length < 500) throw new Error('Incomplete bundle');
      return script;
    });
    await writeClipboard(bundle);
    showFeedback('copy_success');
    setCopyLabels('copied');
  } catch {
    showFeedback('copy_error', 'error');
    setCopyLabels();
  } finally {
    copyButtons.forEach((button) => { button.disabled = false; });
    resetTimer = setTimeout(() => setCopyLabels(), 2200);
  }
}

/**
 * Safari only allows clipboard writes inside the click's user gesture, so the bundle is handed over as a
 * pending ClipboardItem instead of being awaited first.
 */
async function writeClipboard(pendingText) {
  if (navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
    try {
      const blob = pendingText.then((value) => new Blob([value], { type: 'text/plain' }));
      await navigator.clipboard.write([new ClipboardItem({ 'text/plain': blob })]);
      return;
    } catch { /* Fall through to the text API. */ }
  }
  const text = await pendingText;
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch { /* Fall back to the legacy copy command below. */ }
  }
  const fallback = document.createElement('textarea');
  fallback.value = text;
  fallback.setAttribute('readonly', '');
  fallback.className = 'visually-hidden';
  document.body.append(fallback);
  fallback.select();
  const copied = document.execCommand('copy');
  fallback.remove();
  if (!copied) throw new Error('Clipboard unavailable');
}

languageButtons.forEach((button) => button.addEventListener('click', () => {
  applyLanguage(button.dataset.language);
  storage.set(LANGUAGE_KEY, activeLanguage);
  languageMenu.open = false;
  languageSummary.focus();
  feedbackElements.forEach((element) => { element.textContent = ''; });
}));

document.addEventListener('click', (event) => {
  if (languageMenu.open && !languageMenu.contains(event.target)) languageMenu.open = false;
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && languageMenu.open) {
    languageMenu.open = false;
    languageSummary.focus();
  }
});

themeToggle.addEventListener('click', () => {
  const theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
  root.dataset.theme = theme;
  storage.set(THEME_KEY, theme);
  updateThemeControl();
});

copyButtons.forEach((button) => button.addEventListener('click', copyScript));

let fittedWidth = 0;
new ResizeObserver(([entry]) => {
  // Refit only when the width changes; the fit itself changes the height.
  if (Math.abs(entry.contentRect.width - fittedWidth) < 1) return;
  fittedWidth = entry.contentRect.width;
  fitContenders();
}).observe(document.querySelector('.versus'));
document.fonts?.ready.then(fitContenders);
applyLanguage(activeLanguage);
