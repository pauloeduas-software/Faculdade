package com.example.ListaDeTarefas.ui.screens

import android.widget.Toast
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.ListaDeTarefas.data.HeroClass
import com.example.ListaDeTarefas.data.HeroStatus
import com.example.ListaDeTarefas.ui.theme.BackgroundLight
import com.example.ListaDeTarefas.ui.theme.GoldColor
import com.example.ListaDeTarefas.ui.theme.TextColorLight
import androidx.compose.foundation.border

@Composable
fun ClassTreeScreen(
    heroStatus: HeroStatus,
    onClassSelect: (HeroClass) -> String,
    onBack: () -> Unit
) {
    val context = LocalContext.current

    Surface(modifier = Modifier.fillMaxSize(), color = BackgroundLight) {
        Column(Modifier.fillMaxSize()) {
            // Header
            Row(
                modifier = Modifier.padding(16.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(onClick = onBack) {
                    Icon(Icons.Default.ArrowBack, null, tint = TextColorLight)
                }
                Text("Árvore de Classes", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                Spacer(Modifier.weight(1f))
                Text("${heroStatus.gold} G", color = GoldColor, fontWeight = FontWeight.Bold, fontSize = 18.sp)
            }

            LazyColumn(
                modifier = Modifier.fillMaxSize().padding(horizontal = 16.dp),
                verticalArrangement = Arrangement.spacedBy(24.dp),
                contentPadding = PaddingValues(bottom = 32.dp)
            ) {
                // Nível 0
                item { TierRow("Início", 1, listOf(HeroClass.NOVICE), heroStatus, onClassSelect, context) }

                // Nível 5
                item { TierRow("Caminhos (Nv. 5)", 5, listOf(HeroClass.WARRIOR_1, HeroClass.MAGE_1, HeroClass.ROGUE_1), heroStatus, onClassSelect, context) }

                // Nível 10
                item { TierRow("Evolução (Nv. 10)", 10, listOf(HeroClass.WARRIOR_2, HeroClass.MAGE_2, HeroClass.ROGUE_2), heroStatus, onClassSelect, context) }

                // Nível 20
                item { TierRow("Mestria (Nv. 20)", 20, listOf(HeroClass.WARRIOR_3, HeroClass.MAGE_3, HeroClass.ROGUE_3), heroStatus, onClassSelect, context) }

                // Nível 50
                item { TierRow("Lenda (Nv. 50)", 50, listOf(HeroClass.HERO), heroStatus, onClassSelect, context) }
            }
        }
    }
}

@Composable
fun TierRow(
    title: String,
    levelReq: Int,
    classes: List<HeroClass>,
    status: HeroStatus,
    onSelect: (HeroClass) -> String,
    context: android.content.Context
) {
    Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.fillMaxWidth()) {
        Text(title, color = Color.Gray, fontSize = 14.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(bottom = 8.dp))

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceEvenly
        ) {
            classes.forEach { heroClass ->
                ClassNode(heroClass, status, onSelect, context)
            }
        }
    }
}

@Composable
fun ClassNode(
    heroClass: HeroClass,
    status: HeroStatus,
    onSelect: (HeroClass) -> String,
    context: android.content.Context
) {
    val isSelected = status.selectedClass == heroClass
    val isUnlocked = status.level >= heroClass.minLevel
    val canAfford = status.gold >= heroClass.unlockCost

    val backgroundColor = if (isSelected) heroClass.color else if (isUnlocked) Color.White else Color.Gray.copy(alpha = 0.3f)
    val contentColor = if (isSelected) Color.White else if (isUnlocked) heroClass.color else Color.Gray

    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier
            .width(100.dp)
            .clickable {
                val msg = onSelect(heroClass)
                Toast.makeText(context, msg, Toast.LENGTH_SHORT).show()
            }
    ) {
        // Ícone Circular
        Box(
            modifier = Modifier
                .size(60.dp)
                .clip(CircleShape)
                .background(backgroundColor)
                .then(if (isSelected) Modifier else Modifier.run {
                    if(isUnlocked) BorderStroke(2.dp, heroClass.color).let { border(it, CircleShape) } else this
                }),
            contentAlignment = Alignment.Center
        ) {
            if (!isUnlocked) {
                Icon(Icons.Default.Lock, null, tint = Color.Gray)
            } else {
                Icon(heroClass.icon, null, tint = contentColor, modifier = Modifier.size(32.dp))
            }
        }

        Spacer(Modifier.height(4.dp))
        Text(heroClass.label, fontSize = 12.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center, color = TextColorLight)

        if (!isSelected && isUnlocked) {
            Text("${heroClass.unlockCost} G", fontSize = 10.sp, color = GoldColor, fontWeight = FontWeight.Bold)
        }
        if (isSelected) {
            Text("Equipado", fontSize = 10.sp, color = Color.Gray)
        }
    }
}