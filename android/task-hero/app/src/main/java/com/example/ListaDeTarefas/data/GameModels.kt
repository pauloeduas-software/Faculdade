package com.example.ListaDeTarefas.data

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector


enum class HeroClass(val label: String, val icon: ImageVector, val color: Color, val minLevel: Int, val unlockCost: Int) {
    // Nível 1 - Grátis
    NOVICE("Aventureiro", Icons.Default.Backpack, Color(0xFF9E9E9E), 1, 0),

    // Nível 5 - Custo: 100 Ouro
    WARRIOR_1("Escudeiro", Icons.Default.Shield, Color(0xFFE57373), 5, 100),
    MAGE_1("Aprendiz", Icons.Default.AutoFixNormal, Color(0xFF9575CD), 5, 100),
    ROGUE_1("Batedor", Icons.Default.DirectionsRun, Color(0xFFFFB74D), 5, 100),

    // Nível 10 - Custo: 500 Ouro
    WARRIOR_2("Cavaleiro", Icons.Default.Security, Color(0xFFD32F2F), 10, 500),
    MAGE_2("Feiticeiro", Icons.Default.AutoFixHigh, Color(0xFF673AB7), 10, 500),
    ROGUE_2("Assassino", Icons.Default.VisibilityOff, Color(0xFFFF9800), 10, 500),

    // Nível 20 - Custo: 1.500 Ouro
    WARRIOR_3("General", Icons.Default.LocalPolice, Color(0xFFB71C1C), 20, 1500),
    MAGE_3("Arquimago", Icons.Default.School, Color(0xFF4527A0), 20, 1500),
    ROGUE_3("Mestre Sombras", Icons.Default.VpnKey, Color(0xFFEF6C00), 20, 1500),

    // Nível 50 - Custo: 5.000 Ouro
    HERO("Lenda Viva", Icons.Default.WorkspacePremium, Color(0xFFFFD700), 50, 5000)
}

// 2 DEFINIÇÃO DAS BADGES
data class Badge(
    val id: String,
    val name: String,
    val description: String,
    val icon: ImageVector,
    val color: Color
)

// 3 DADOS DO JOGO
enum class EffortLevel(val xp: Int, val gold: Int, val label: String, val color: Color) {
    // Aumentei o Ouro para dar mais poder de compra ao jogador
    EASY(10, 10, "Fácil", Color(0xFF4CAF50)),       // Era 5 gold
    MEDIUM(30, 25, "Médio", Color(0xFFFF9800)),     // Era 15 gold
    HARD(50, 50, "Difícil", Color(0xFFF44336)),     // Era 25 gold
    CRITICAL(100, 100, "Crítico", Color(0xFF9C27B0)) // Era 50 gold
}

data class Task(
    val id: Long,
    val description: String,
    val details: String = "",
    val isCompleted: Boolean = false,
    val effort: EffortLevel = EffortLevel.MEDIUM
)

data class HeroStatus(
    val level: Int = 1,
    val currentXp: Int = 0,
    val xpToNextLevel: Int = 100,
    val gold: Int = 0,
    val heroName: String = "Jogador",
    val selectedClass: HeroClass = HeroClass.NOVICE,
    val earnedBadges: List<String> = emptyList()
)