package com.example.ListaDeTarefas.ui.screens

import android.widget.Toast
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.CardGiftcard
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.MonetizationOn
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.ListaDeTarefas.data.HeroStatus
import com.example.ListaDeTarefas.ui.ShopItem
import com.example.ListaDeTarefas.ui.theme.*

@Composable
fun ShopScreen(
    heroStatus: HeroStatus,
    shopItems: List<ShopItem>,
    onBuyItem: (Int) -> Boolean,
    onAddItem: (String, Int) -> Unit,
    onDeleteItem: (ShopItem) -> Unit
) {
    val context = LocalContext.current
    var showSuccessDialog by remember { mutableStateOf(false) }
    var purchasedItemName by remember { mutableStateOf("") }
    var showAddDialog by remember { mutableStateOf(false) }

    // POP-UP DE SUCESSO
    if (showSuccessDialog) {
        AlertDialog(
            onDismissRequest = { showSuccessDialog = false },
            containerColor = BackgroundLight,
            shape = RoundedCornerShape(16.dp),
            icon = {
                Icon(Icons.Default.CheckCircle, null, tint = SuccessGreen, modifier = Modifier.size(48.dp))
            },
            title = {
                Text(
                    text = "Recompensa Resgatada!",
                    color = SuccessGreen,
                    fontWeight = FontWeight.Bold,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth()
                )
            },
            text = {
                Text(
                    text = "Você adquiriu: $purchasedItemName.\nAproveite seu momento, herói!",
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth(),
                    style = MaterialTheme.typography.bodyLarge
                )
            },
            confirmButton = {
                // Centraliza o botão
                Box(
                    modifier = Modifier.fillMaxWidth(),
                    contentAlignment = Alignment.Center
                ) {
                    Button(
                        onClick = { showSuccessDialog = false },
                        colors = ButtonDefaults.buttonColors(containerColor = SuccessGreen)
                    ) {
                        Text("Aproveitar")
                    }
                }
            }
        )
    }

    // Dialog de Adicionar Nova Recompensa
    if (showAddDialog) {
        AddRewardDialog(
            onDismiss = { showAddDialog = false },
            onConfirm = { name, cost ->
                onAddItem(name, cost)
                showAddDialog = false
            }
        )
    }

    Surface(modifier = Modifier.fillMaxSize(), color = BackgroundLight) {
        Column(modifier = Modifier.padding(16.dp)) {
            // Saldo e Botão Adicionar
            Row(
                modifier = Modifier.fillMaxWidth().padding(bottom = 16.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Card(
                    colors = CardDefaults.cardColors(containerColor = CardSurfaceLight),
                    border = BorderStroke(1.dp, GoldColor),
                    modifier = Modifier.weight(1f).padding(end = 8.dp)
                ) {
                    Row(
                        modifier = Modifier.padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.Center
                    ) {
                        Icon(Icons.Default.MonetizationOn, null, tint = GoldColor, modifier = Modifier.size(24.dp))
                        Spacer(Modifier.width(8.dp))
                        Text("${heroStatus.gold} Ouro", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = GoldColor)
                    }
                }

                FloatingActionButton(
                    onClick = { showAddDialog = true },
                    containerColor = GoldColor,
                    contentColor = Color.White
                ) {
                    Icon(Icons.Default.Add, contentDescription = "Criar Recompensa")
                }
            }

            Text("Suas Recompensas", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, color = TextColorLight)
            Spacer(Modifier.height(16.dp))

            if (shopItems.isEmpty()) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Text("Nenhuma recompensa criada.\nToque no + para criar!", textAlign = TextAlign.Center, color = Color.Gray)
                }
            } else {
                LazyVerticalGrid(
                    columns = GridCells.Fixed(2),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    items(shopItems) { item ->
                        ShopItemCard(
                            item = item,
                            currentGold = heroStatus.gold,
                            onBuy = {
                                if (onBuyItem(item.cost)) {
                                    purchasedItemName = item.name
                                    showSuccessDialog = true
                                } else {
                                    Toast.makeText(context, "Ouro insuficiente!", Toast.LENGTH_SHORT).show()
                                }
                            },
                            onDelete = { onDeleteItem(item) }
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun ShopItemCard(item: ShopItem, currentGold: Int, onBuy: () -> Unit, onDelete: () -> Unit) {
    val canAfford = currentGold >= item.cost

    Card(
        colors = CardDefaults.cardColors(containerColor = CardSurfaceLight),
        elevation = CardDefaults.cardElevation(2.dp)
    ) {
        Box {
            IconButton(
                onClick = onDelete,
                modifier = Modifier.align(Alignment.TopEnd).size(32.dp)
            ) {
                Icon(Icons.Default.Close, null, tint = Color.Gray.copy(0.5f), modifier = Modifier.size(16.dp))
            }

            Column(
                modifier = Modifier.padding(16.dp).fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Icon(Icons.Default.CardGiftcard, null, tint = if(canAfford) XpColor else Color.Gray, modifier = Modifier.size(40.dp))
                Spacer(Modifier.height(8.dp))
                Text(item.name, fontWeight = FontWeight.Bold, color = TextColorLight, textAlign = TextAlign.Center, maxLines = 1)
                Text("${item.cost} Ouro", color = GoldColor, fontWeight = FontWeight.SemiBold)
                Spacer(Modifier.height(12.dp))
                Button(
                    onClick = onBuy,
                    enabled = canAfford,
                    colors = ButtonDefaults.buttonColors(containerColor = GoldColor),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text("Comprar")
                }
            }
        }
    }
}

@Composable
fun AddRewardDialog(onDismiss: () -> Unit, onConfirm: (String, Int) -> Unit) {
    var name by remember { mutableStateOf("") }
    var costStr by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Nova Recompensa") },
        text = {
            Column {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("O que você quer ganhar?") },
                    placeholder = { Text("Ex: Comer Chocolate") },
                    colors = getTextFieldColorsLight()
                )
                Spacer(Modifier.height(8.dp))
                OutlinedTextField(
                    value = costStr,
                    onValueChange = { if (it.all { char -> char.isDigit() }) costStr = it },
                    label = { Text("Custo em Ouro") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    colors = getTextFieldColorsLight()
                )
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    val cost = costStr.toIntOrNull()
                    if (name.isNotBlank() && cost != null && cost > 0) {
                        onConfirm(name, cost)
                    }
                },
                colors = ButtonDefaults.buttonColors(containerColor = SuccessGreen)
            ) { Text("Criar") }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancelar", color = DangerRed) }
        },
        containerColor = BackgroundLight
    )
}