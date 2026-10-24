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
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.ListaDeTarefas.data.EffortLevel
import com.example.ListaDeTarefas.data.Task
import com.example.ListaDeTarefas.ui.theme.*

@Composable
fun TaskListScreen(
    tasks: List<Task>,
    currentLevel: Int,
    onTaskClick: (Task) -> Unit,
    onAddTask: (String, EffortLevel) -> Unit
) {
    var newTaskText by remember { mutableStateOf("") }
    var selectedEffort by remember { mutableStateOf(EffortLevel.MEDIUM) }
    val focusRequester = remember { FocusRequester() }

    Surface(modifier = Modifier.fillMaxSize(), color = BackgroundLight) {
        Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {

            Text("Nova Missão", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.ExtraBold, color = TextColorLight)
            Spacer(Modifier.height(16.dp))

            // Seletor de Dificuldade
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                EffortLevel.entries.forEach { effort ->
                    val isSelected = selectedEffort == effort
                    Button(
                        onClick = { selectedEffort = effort },
                        modifier = Modifier.weight(1f).height(40.dp),
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = if (isSelected) effort.color else CardSurfaceLight,
                            contentColor = if (isSelected) Color.White else effort.color
                        ),
                        border = if (!isSelected) BorderStroke(1.dp, effort.color) else null,
                        contentPadding = PaddingValues(0.dp)
                    ) {
                        Text(effort.label, fontSize = 11.sp, fontWeight = FontWeight.Bold, maxLines = 1)
                    }
                }
            }
            Spacer(Modifier.height(12.dp))

            Row(
                modifier = Modifier.fillMaxWidth().padding(bottom = 24.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                OutlinedTextField(
                    value = newTaskText,
                    onValueChange = { newTaskText = it },
                    label = { Text("Nome da Missão") },
                    colors = getTextFieldColorsLight(),
                    shape = RoundedCornerShape(12.dp),
                    textStyle = TextStyle(color = TextColorLight),
                    modifier = Modifier.weight(1f).focusRequester(focusRequester),
                    singleLine = true
                )
                Button(
                    onClick = {
                        if (newTaskText.isNotBlank()) {
                            onAddTask(newTaskText, selectedEffort)
                            newTaskText = ""
                            focusRequester.requestFocus()
                        }
                    },
                    enabled = newTaskText.isNotBlank(),
                    modifier = Modifier.size(56.dp),
                    shape = RoundedCornerShape(12.dp),
                    contentPadding = PaddingValues(0.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = TextColorLight)
                ) {
                    Icon(Icons.Default.Add, contentDescription = "Adicionar", tint = Color.White)
                }
            }

            Text("Quadro de Missões", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = Color.Gray)
            Spacer(Modifier.height(12.dp))

            if (tasks.isEmpty()) {
                Box(modifier = Modifier.fillMaxWidth().weight(1f), contentAlignment = Alignment.Center) {
                    Text("Nenhuma missão pendente.\nO reino está em paz.", fontSize = 16.sp, color = Color.Gray, textAlign = TextAlign.Center)
                }
            } else {
                LazyVerticalGrid(
                    columns = GridCells.Fixed(2),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    modifier = Modifier.weight(1f)
                ) {
                    items(tasks) { task ->
                        // Passa o nível atual para o card
                        TaskGridItem(task = task, currentLevel = currentLevel, onTaskClick = onTaskClick)
                    }
                }
            }
        }
    }
}

@Composable
fun TaskGridItem(task: Task, currentLevel: Int, onTaskClick: (Task) -> Unit) {
    // Calcula o XP real para mostrar ao usuário
    val bonusMultiplier = 1 + (currentLevel * 0.02)
    val displayXp = (task.effort.xp * bonusMultiplier).toInt()

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .aspectRatio(0.9f)
            .clickable { onTaskClick(task) },
        elevation = CardDefaults.cardElevation(defaultElevation = 4.dp),
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(containerColor = CardSurfaceLight),
        border = BorderStroke(1.dp, DividerColorLight)
    ) {
        Column(
            modifier = Modifier.padding(12.dp).fillMaxSize(),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Box(
                modifier = Modifier.size(56.dp).clip(CircleShape).background(task.effort.color.copy(alpha = 0.15f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(Icons.Default.Star, null, tint = task.effort.color, modifier = Modifier.size(32.dp))
            }

            Spacer(Modifier.height(12.dp))

            Text(
                text = task.description,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.ExtraBold,
                color = TextColorLight,
                textAlign = TextAlign.Center,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis
            )

            Spacer(Modifier.height(12.dp))

            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.Center,
                modifier = Modifier
                    .wrapContentWidth()
                    .background(BackgroundLight, RoundedCornerShape(8.dp))
                    .padding(horizontal = 12.dp, vertical = 6.dp)
            ) {
                // MOSTRA O XP CALCULADO
                Text(
                    text = "+$displayXp XP",
                    fontWeight = FontWeight.Bold,
                    color = XpColor,
                    fontSize = 12.sp
                )
                Spacer(Modifier.width(8.dp))
                Text(
                    text = "+${task.effort.gold} $",
                    fontWeight = FontWeight.Bold,
                    color = GoldColor,
                    fontSize = 12.sp
                )
            }
        }
    }
}