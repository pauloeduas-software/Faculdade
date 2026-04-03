package com.example.ListaDeTarefas

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.*
import com.example.ListaDeTarefas.ui.GameViewModel
import com.example.ListaDeTarefas.ui.theme.*
import com.example.ListaDeTarefas.ui.screens.*
import com.google.firebase.auth.FirebaseAuth

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            AulaTelasTheme {
                val viewModel: GameViewModel = viewModel()
                val uiState by viewModel.uiState.collectAsState()
                val navController = rememberNavController()

                // POP-UP DE LEVEL UP
                if (uiState.showLevelUpDialog) {
                    AlertDialog(
                        onDismissRequest = { viewModel.dismissLevelUpDialog() },
                        title = { Text("LEVEL UP!", color = GoldColor, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth()) },
                        text = { Text("Parabéns! Você alcançou o nível ${uiState.newLevelAchieved}.", textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth()) },
                        icon = { Icon(Icons.Default.EmojiEvents, null, tint = GoldColor, modifier = Modifier.size(48.dp)) },
                        confirmButton = {
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center) {
                                Button(onClick = { viewModel.dismissLevelUpDialog() }, colors = ButtonDefaults.buttonColors(containerColor = GoldColor)) {
                                    Text("Incrível!", color = Color.Black, fontWeight = FontWeight.Bold)
                                }
                            }
                        },
                        containerColor = BackgroundLight,
                        shape = RoundedCornerShape(16.dp)
                    )
                }

                // POP-UP DE CONQUISTA
                if (uiState.showBadgeDialog && uiState.newBadgeEarned != null) {
                    AlertDialog(
                        onDismissRequest = { viewModel.dismissBadgeDialog() },
                        title = { Text("CONQUISTA!", color = uiState.newBadgeEarned!!.color, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth()) },
                        icon = { Icon(uiState.newBadgeEarned!!.icon, null, tint = uiState.newBadgeEarned!!.color, modifier = Modifier.size(48.dp)) },
                        text = {
                            Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.fillMaxWidth()) {
                                Text("Você desbloqueou: ${uiState.newBadgeEarned!!.name}", fontWeight = FontWeight.Bold, textAlign = TextAlign.Center)
                                Spacer(Modifier.height(8.dp))
                                Text(uiState.newBadgeEarned!!.description, color = Color.Gray, textAlign = TextAlign.Center, fontSize = 14.sp)
                            }
                        },
                        confirmButton = {
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center) {
                                Button(onClick = { viewModel.dismissBadgeDialog() }, colors = ButtonDefaults.buttonColors(containerColor = uiState.newBadgeEarned!!.color)) {
                                    Text("Sensacional!", color = Color.White, fontWeight = FontWeight.Bold)
                                }
                            }
                        },
                        containerColor = BackgroundLight,
                        shape = RoundedCornerShape(16.dp)
                    )
                }

                // NAVEGAÇÃO PRINCIPAL
                if (!uiState.isLoggedIn) {
                    NavHost(navController = navController, startDestination = "login") {
                        composable("login") {
                            LoginScreen(
                                onLoginClick = { email, pass -> viewModel.login(email, pass) },
                                onNavigateToRegister = { navController.navigate("register") },
                                errorMessage = uiState.authError
                            )
                        }
                        composable("register") {
                            RegisterScreen(
                                onRegisterClick = { email, pass, name -> viewModel.register(email, pass, name) },
                                onNavigateToLogin = { navController.popBackStack() },
                                errorMessage = uiState.authError
                            )
                        }
                    }
                } else {
                    Scaffold(
                        bottomBar = {
                            NavigationBar {
                                val navBackStackEntry by navController.currentBackStackEntryAsState()
                                val currentRoute = navBackStackEntry?.destination?.route
                                val items = listOf(
                                    Triple("home", "Início", Icons.Default.Home),
                                    Triple("tasks", "Missões", Icons.Default.List),
                                    Triple("shop", "Loja", Icons.Default.ShoppingCart),
                                    Triple("completed", "Histórico", Icons.Default.CheckCircle),
                                    Triple("account", "Conta", Icons.Default.AccountCircle)
                                )
                                items.forEach { (route, label, icon) ->
                                    NavigationBarItem(
                                        icon = { Icon(icon, null) },
                                        label = { Text(label) },
                                        selected = currentRoute == route,
                                        onClick = { navController.navigate(route) { popUpTo(navController.graph.findStartDestination().id) { saveState = true }; launchSingleTop = true; restoreState = true } }
                                    )
                                }
                            }
                        }
                    ) { innerPadding ->
                        NavHost(navController = navController, startDestination = "home", modifier = Modifier.padding(innerPadding)) {

                            composable("home") { HomeScreen(uiState.heroStatus, uiState.tasks) }

                            composable("tasks") {
                                TaskListScreen(
                                    tasks = uiState.tasks.filter { !it.isCompleted },
                                    currentLevel = uiState.heroStatus.level, // PASSA O NÍVEL AQUI
                                    onTaskClick = { task -> navController.navigate("details/${task.id}") },
                                    onAddTask = { desc, effort -> viewModel.addTask(desc, effort) }
                                )
                            }

                            composable("shop") {
                                ShopScreen(
                                    heroStatus = uiState.heroStatus,
                                    shopItems = uiState.shopItems,
                                    onBuyItem = { cost -> viewModel.buyReward(cost) },
                                    onAddItem = { name, cost -> viewModel.addShopItem(name, cost) },
                                    onDeleteItem = { item -> viewModel.deleteShopItem(item) }
                                )
                            }

                            composable("completed") {
                                CompletedTasksScreen(
                                    tasks = uiState.tasks.filter { it.isCompleted },
                                    onTaskClick = { task -> navController.navigate("details/${task.id}") },
                                    onDeleteTask = { task -> viewModel.deleteTask(task) }
                                )
                            }

                            composable("account") {
                                AccountScreen(
                                    userEmail = FirebaseAuth.getInstance().currentUser?.email,
                                    heroStatus = uiState.heroStatus,
                                    availableBadges = viewModel.availableBadges,
                                    onLogoutClick = { viewModel.logout() },
                                    onOpenClassTree = { navController.navigate("class_tree") }
                                )
                            }

                            composable("class_tree") {
                                ClassTreeScreen(
                                    heroStatus = uiState.heroStatus,
                                    onClassSelect = { newClass -> viewModel.selectClass(newClass) },
                                    onBack = { navController.popBackStack() }
                                )
                            }

                            composable("details/{taskId}") { backStackEntry ->
                                val taskId = backStackEntry.arguments?.getString("taskId")?.toLongOrNull()
                                val selectedTask = uiState.tasks.find { it.id == taskId }
                                TaskDetailsScreen(
                                    task = selectedTask,
                                    currentLevel = uiState.heroStatus.level,
                                    onCompleteTask = { viewModel.completeTask(it); navController.popBackStack() },
                                    onUpdateDescription = { task, txt -> viewModel.updateDescription(task, txt) },
                                    onUpdateDetails = { task, txt -> viewModel.updateDetails(task, txt) },
                                    onDeleteTask = { task -> viewModel.deleteTask(task) },
                                    onNavigateBack = { navController.popBackStack() }
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}