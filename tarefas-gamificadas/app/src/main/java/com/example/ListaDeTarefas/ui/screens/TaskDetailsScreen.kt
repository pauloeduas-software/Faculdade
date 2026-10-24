package com.example.ListaDeTarefas.ui.screens

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.ListaDeTarefas.data.Task
import com.example.ListaDeTarefas.ui.theme.*
import kotlinx.coroutines.delay

@Composable
fun TaskDetailsScreen(
    task: Task?,
    currentLevel: Int,
    onCompleteTask: (Task) -> Unit,
    onUpdateDescription: (Task, String) -> Unit,
    onUpdateDetails: (Task, String) -> Unit,
    onDeleteTask: (Task) -> Unit,
    onNavigateBack: () -> Unit
) {
    if (task == null) return

    var currentDescription by remember(task.id) { mutableStateOf(task.description) }
    var currentDetails by remember(task.id) { mutableStateOf(task.details) }
    var justCompleted by remember(task.id) { mutableStateOf(false) }
    val haptics = LocalHapticFeedback.current

    // CÁLCULO VISUAL DO XP
    val bonusMultiplier = 1 + (currentLevel * 0.02)
    val displayXp = (task.effort.xp * bonusMultiplier).toInt()

    val animatedBorderColor by animateColorAsState(
        targetValue = if (justCompleted) SuccessGreen else Color.Transparent,
        animationSpec = tween(durationMillis = 400), label = ""
    )

    LaunchedEffect(justCompleted) {
        if (justCompleted) { delay(1500); justCompleted = false }
    }

    Surface(modifier = Modifier.fillMaxSize(), color = BackgroundLight) {
        Column(Modifier.fillMaxSize()) {

            Row(
                modifier = Modifier.fillMaxWidth().padding(16.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(onClick = onNavigateBack) {
                    Icon(Icons.Default.ArrowBack, contentDescription = "Voltar", tint = TextColorLight)
                }

                IconButton(onClick = {
                    onDeleteTask(task)
                    onNavigateBack()
                }) {
                    Icon(Icons.Default.Delete, contentDescription = "Excluir", tint = DangerRed)
                }
            }

            Column(Modifier.weight(1f).padding(horizontal = 16.dp)) {
                Card(
                    modifier = Modifier.fillMaxWidth().weight(1f),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = CardSurfaceLight),
                    border = BorderStroke(2.dp, animatedBorderColor)
                ) {
                    Column(Modifier.padding(16.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            val isCompleted = task.isCompleted
                            val statusColor = if (isCompleted) SuccessGreen else DangerRed
                            Icon(if (isCompleted) Icons.Default.CheckCircle else Icons.Default.HourglassTop, "Status", tint = statusColor)
                            Text(if (isCompleted) "CONCLUÍDA" else "PENDENTE", color = statusColor, fontWeight = FontWeight.ExtraBold)
                        }
                        Divider(Modifier.padding(vertical = 12.dp), color = DividerColorLight)

                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceAround) {
                            // MOSTRA O XP CALCULADO
                            RewardChip("+$displayXp XP", XpColor, Icons.Default.Star)
                            RewardChip("+${task.effort.gold} Ouro", GoldColor, Icons.Default.MonetizationOn)
                        }

                        Divider(Modifier.padding(vertical = 12.dp), color = DividerColorLight)

                        OutlinedTextField(
                            value = currentDescription,
                            onValueChange = { currentDescription = it },
                            label = { Text("Nome da Missão") },
                            modifier = Modifier.fillMaxWidth(),
                            colors = getTextFieldColorsLight()
                        )
                        Spacer(Modifier.height(12.dp))
                        OutlinedTextField(
                            value = currentDetails,
                            onValueChange = { currentDetails = it },
                            label = { Text("Detalhes") },
                            modifier = Modifier.fillMaxWidth().weight(1f),
                            colors = getTextFieldColorsLight()
                        )
                    }
                }

                Spacer(Modifier.height(16.dp))

                val canSave = (currentDescription != task.description) || (currentDetails != task.details)
                Button(
                    onClick = { onUpdateDescription(task, currentDescription); onUpdateDetails(task, currentDetails) },
                    enabled = canSave && !task.isCompleted,
                    modifier = Modifier.fillMaxWidth().height(50.dp)
                ) { Text("Salvar Alterações") }

                Spacer(Modifier.height(8.dp))

                if (!task.isCompleted) {
                    Button(
                        onClick = { justCompleted = true; haptics.performHapticFeedback(HapticFeedbackType.LongPress); onCompleteTask(task) },
                        modifier = Modifier.fillMaxWidth().height(50.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = SuccessGreen)
                    ) { Text("Completar Missão") }
                }
                Spacer(Modifier.height(16.dp))
            }
        }
    }
}

@Composable
private fun RewardChip(value: String, color: Color, icon: ImageVector) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier.clip(RoundedCornerShape(50)).background(color.copy(alpha = 0.1f)).padding(horizontal = 12.dp, vertical = 6.dp)
    ) {
        Icon(icon, null, tint = color, modifier = Modifier.size(18.dp))
        Spacer(Modifier.width(6.dp))
        Text(value, color = color, fontWeight = FontWeight.Bold, fontSize = 14.sp)
    }
}