package com.example.ListaDeTarefas.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ExitToApp
import androidx.compose.material.icons.filled.GridView
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.ListaDeTarefas.data.Badge
import com.example.ListaDeTarefas.data.HeroStatus
import com.example.ListaDeTarefas.ui.theme.*

@Composable
fun AccountScreen(
    userEmail: String?,
    heroStatus: HeroStatus,
    availableBadges: List<Badge>,
    onLogoutClick: () -> Unit,
    onOpenClassTree: () -> Unit
) {
    // Estado para controlar qual conquista foi clicada
    var selectedBadge by remember { mutableStateOf<Badge?>(null) }

    // POP-UP DE DETALHES
    if (selectedBadge != null) {
        val badge = selectedBadge!!
        val isEarned = heroStatus.earnedBadges.contains(badge.id)
        val badgeColor = if (isEarned) badge.color else Color.Gray

        AlertDialog(
            onDismissRequest = { selectedBadge = null },
            icon = {
                Icon(
                    if (isEarned) badge.icon else Icons.Default.Lock,
                    contentDescription = null,
                    tint = badgeColor,
                    modifier = Modifier.size(48.dp)
                )
            },
            title = {
                Text(
                    text = if (isEarned) badge.name else "Bloqueado",
                    color = badgeColor,
                    fontWeight = FontWeight.Bold
                )
            },
            text = {
                Text(
                    text = if (isEarned) badge.description else "Continue jogando para descobrir como desbloquear esta conquista!",
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth()
                )
            },
            confirmButton = {
                TextButton(onClick = { selectedBadge = null }) {
                    Text("Fechar", color = badgeColor)
                }
            },
            containerColor = BackgroundLight, // Mantém o padrão claro
            shape = RoundedCornerShape(16.dp)
        )
    }

    // TELA PRINCIPAL
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(text = "Perfil do Jogador", fontSize = 24.sp, style = MaterialTheme.typography.titleLarge, color = TextColorLight)

        if (userEmail != null) {
            Text(text = userEmail, fontSize = 14.sp, color = Color.Gray)
        }

        Spacer(modifier = Modifier.height(24.dp))

        // Card com as informações globais
        Card(
            modifier = Modifier.fillMaxWidth(),
            // Usa as cores do tema em vez de cores fixas escuras
            colors = CardDefaults.cardColors(containerColor = CardSurfaceLight),
            border = BorderStroke(1.dp, DividerColorLight), // Borda fina para definição
            elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text(text = "Classe Atual:", color = Color.Gray, fontSize = 14.sp)
                Text(
                    text = heroStatus.selectedClass.label,
                    color = heroStatus.selectedClass.color,
                    fontSize = 22.sp,
                    style = MaterialTheme.typography.titleLarge
                )

                Spacer(modifier = Modifier.height(16.dp))

                Text(text = "Saldo Disponível:", color = Color.Gray, fontSize = 14.sp)
                Text(
                    text = "${heroStatus.gold} G",
                    color = GoldColor,
                    fontSize = 22.sp,
                    style = MaterialTheme.typography.titleLarge
                )
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Botão da Árvore de Classes
        Button(
            onClick = onOpenClassTree,
            modifier = Modifier.fillMaxWidth().height(50.dp),
            // Usa TextColorLight (geralmente preto/azul escuro do tema) ou GoldColor
            colors = ButtonDefaults.buttonColors(containerColor = TextColorLight),
            shape = RoundedCornerShape(12.dp)
        ) {
            Icon(Icons.Default.GridView, null, tint = Color.White)
            Spacer(Modifier.width(8.dp))
            Text("Ver Árvore de Classes", color = Color.White, fontWeight = FontWeight.Bold)
        }

        Spacer(modifier = Modifier.height(24.dp))

        // SEÇÃO DE BADGES EM GRADE
        Text("Suas Conquistas", fontWeight = FontWeight.Bold, color = Color.Gray)
        Text("(Toque para ver detalhes)", fontSize = 12.sp, color = Color.LightGray)
        Spacer(modifier = Modifier.height(12.dp))

        LazyVerticalGrid(
            columns = GridCells.Fixed(4),
            verticalArrangement = Arrangement.spacedBy(16.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
        ) {
            items(availableBadges) { badge ->
                val isEarned = heroStatus.earnedBadges.contains(badge.id)
                BadgeItemDisplay(
                    badge = badge,
                    isEarned = isEarned,
                    onClick = { selectedBadge = badge }
                )
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Botão de Logout
        Button(
            onClick = onLogoutClick,
            modifier = Modifier
                .fillMaxWidth()
                .height(56.dp),
            colors = ButtonDefaults.buttonColors(containerColor = DangerRed),
            shape = RoundedCornerShape(12.dp)
        ) {
            Icon(Icons.Default.ExitToApp, null)
            Spacer(Modifier.width(8.dp))
            Text("Sair da Conta", fontSize = 16.sp, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
fun BadgeItemDisplay(badge: Badge, isEarned: Boolean, onClick: () -> Unit) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.clickable { onClick() }
    ) {
        Box(
            modifier = Modifier
                .size(60.dp)
                .clip(CircleShape)
                .background(if (isEarned) badge.color.copy(alpha = 0.2f) else Color.Gray.copy(alpha = 0.1f)),
            contentAlignment = Alignment.Center
        ) {
            if (isEarned) {
                Icon(badge.icon, null, tint = badge.color, modifier = Modifier.size(32.dp))
            } else {
                Icon(Icons.Default.Lock, null, tint = Color.Gray, modifier = Modifier.size(24.dp))
            }
        }
    }
}