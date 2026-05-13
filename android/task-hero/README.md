# TaskHero - Gamificacão de Produtividade

[![Kotlin](https://img.shields.io/badge/Kotlin-7F52FF?logo=kotlin&logoColor=white)](https://kotlinlang.org/)
[![Jetpack Compose](https://img.shields.io/badge/Jetpack_Compose-4285F4?logo=jetpack-compose&logoColor=white)](https://developer.android.com/jetpack/compose)
[![Firebase](https://img.shields.io/badge/Firebase-DD2C00?logo=firebase&logoColor=white)](https://firebase.google.com/)
[![Android](https://img.shields.io/badge/Android-3DDC84?logo=android&logoColor=white)](https://developer.android.com/android)

TaskHero é um aplicativo Android que transforma listas de tarefas em uma jornada de RPG. O jogo permite ganhar XP, acumular ouro e evoluir o personagem conforme o usuário conclui suas atividades diárias.

---

## ✨ Mecânicas do Projeto

- **Sistema de Níveis**: Ganho de XP ao completar tarefas, com multiplicador baseado no nível atual do usuário.
- **Economia de Ouro**: Recompensas baseadas no nível de esforço (Easy, Medium, Hard, Critical).
- **Conquistas (Badges)**: Sistema de marcos de produtividade.
- **Classes de Herói**: Desbloqueio e troca de classes (Guerreiro, Mago, Arqueiro) baseado no progresso.
- **Loja de Recompensas**: Gerenciamento de recompensas personalizadas.

---

## 🛠️ Stack Tecnológica

| Categoria | Tecnologia |
| :--- | :--- |
| **Linguagem** | Kotlin |
| **UI Framework** | Jetpack Compose |
| **Arquitetura** | MVVM (Model-View-ViewModel) |
| **Backend** | Firebase Firestore e Firebase Authentication |
| **Estado** | StateFlow e ViewModels |

---

## 📂 Estrutura Arquitetural

```text
├── app/
│   └── src/main/java/com/example/ListaDeTarefas/
│       ├── data/          # Repositórios e Data Sources (Firebase)
│       ├── ui/            # Screens e ViewModels (Jetpack Compose)
│       └── model/         # Classes de dados (Hero, Task, Badge)
├── build.gradle.kts       # Configurações do projeto
└── README.md              # Documentação do app
```

---

## 🚀 Como Executar

1. Importe o projeto no **Android Studio**.
2. Adicione o arquivo `google-services.json` na pasta `app/`.
3. Sincronize o **Gradle** e execute no emulador ou dispositivo físico.

---
