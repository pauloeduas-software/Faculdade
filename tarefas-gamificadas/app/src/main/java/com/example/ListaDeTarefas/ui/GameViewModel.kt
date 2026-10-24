package com.example.ListaDeTarefas.ui

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.lifecycle.ViewModel
import com.example.ListaDeTarefas.data.*
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.SetOptions
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import androidx.compose.ui.graphics.Color

data class ShopItem(val id: Long = 0, val name: String = "", val cost: Int = 0)

data class GameUiState(
    val heroStatus: HeroStatus = HeroStatus(),
    val tasks: List<Task> = listOf(),
    val shopItems: List<ShopItem> = listOf(),
    val isLoggedIn: Boolean = false,
    val authError: String? = null,
    val isLoading: Boolean = false,
    val showLevelUpDialog: Boolean = false,
    val newLevelAchieved: Int = 0,
    val showBadgeDialog: Boolean = false,
    val newBadgeEarned: Badge? = null
)

class GameViewModel : ViewModel() {
    private val _uiState = MutableStateFlow(GameUiState())
    val uiState: StateFlow<GameUiState> = _uiState.asStateFlow()
    private val auth: FirebaseAuth = FirebaseAuth.getInstance()
    private val db: FirebaseFirestore = FirebaseFirestore.getInstance()

    // AS CONQUISTAS
    val availableBadges = listOf(
        Badge("first_step", "Primeiro Passo", "Complete 1 missão.", Icons.Default.Flag, EffortLevel.EASY.color),
        Badge("worker", "Trabalhador", "Complete 5 missões.", Icons.Default.Construction, EffortLevel.MEDIUM.color),
        Badge("legend", "Lenda", "Complete 20 missões.", Icons.Default.HistoryEdu, EffortLevel.CRITICAL.color),
        Badge("saver", "Poupador", "Junte 100 de Ouro.", Icons.Default.Savings, EffortLevel.EASY.color),
        Badge("rich", "Magnata", "Junte 1.000 de Ouro.", Icons.Default.MonetizationOn, EffortLevel.HARD.color),
        Badge("shop", "Consumista", "Compre 1 item na loja.", Icons.Default.ShoppingCart, EffortLevel.MEDIUM.color),
        Badge("level5", "Promissor", "Alcance o Nível 5.", Icons.Default.Star, EffortLevel.EASY.color),
        Badge("level10", "Veterano", "Alcance o Nível 10.", Icons.Default.MilitaryTech, EffortLevel.HARD.color),
        Badge("level20", "Divindade", "Alcance o Nível 20.", Icons.Default.AutoAwesome, EffortLevel.CRITICAL.color),
        Badge("cleaner", "Faxineiro", "Exclua uma tarefa antiga.", Icons.Default.DeleteSweep, Color.Gray)
    )

    init {
        if (auth.currentUser != null) loadUserData()
    }

    //  LÓGICA DE VERIFICAÇÃO DE CONQUISTAS
    private fun checkBadges(status: HeroStatus, tasks: List<Task>, action: String = "") {
        val myBadges = status.earnedBadges.toMutableList()
        var newlyEarned: Badge? = null
        val completedCount = tasks.count { it.isCompleted }

        val checks = mapOf(
            "first_step" to (completedCount >= 1),
            "worker" to (completedCount >= 5),
            "legend" to (completedCount >= 20),
            "saver" to (status.gold >= 100),
            "rich" to (status.gold >= 1000),
            "level5" to (status.level >= 5),
            "level10" to (status.level >= 10),
            "level20" to (status.level >= 20),
            "shop" to (action == "shop_buy"),
            "cleaner" to (action == "delete_task")
        )

        checks.forEach { (id, condition) ->
            if (condition && !myBadges.contains(id)) {
                myBadges.add(id)
                newlyEarned = availableBadges.find { it.id == id }
            }
        }

        if (newlyEarned != null) {
            val newStatus = status.copy(earnedBadges = myBadges)
            _uiState.update { it.copy(heroStatus = newStatus, showBadgeDialog = true, newBadgeEarned = newlyEarned) }
            saveUserData()
        }
    }

    // CLASSES E PROGRESSÃO
    fun selectClass(newClass: HeroClass): String {
        val currentState = _uiState.value
        val currentStatus = currentState.heroStatus

        if (currentStatus.selectedClass == newClass) return "Você já é desta classe."
        if (currentStatus.level < newClass.minLevel) return "Nível ${newClass.minLevel} necessário!"
        if (currentStatus.gold < newClass.unlockCost) return "Ouro insuficiente! Custa ${newClass.unlockCost}."

        val newGold = currentStatus.gold - newClass.unlockCost
        val newStatus = currentStatus.copy(
            selectedClass = newClass,
            gold = newGold
        )

        _uiState.update { it.copy(heroStatus = newStatus) }
        saveUserData()
        return "Classe alterada com sucesso!"
    }

    //  MÉTODOS DE AÇÃO
    fun deleteTask(task: Task) {
        val updatedList = _uiState.value.tasks.filter { it.id != task.id }
        _uiState.update { it.copy(tasks = updatedList) }
        checkBadges(_uiState.value.heroStatus, updatedList, "delete_task")
        saveUserData()
    }

    fun buyReward(cost: Int): Boolean {
        val currentGold = _uiState.value.heroStatus.gold
        if (currentGold >= cost) {
            val newStatus = _uiState.value.heroStatus.copy(gold = currentGold - cost)
            _uiState.update { it.copy(heroStatus = newStatus) }
            checkBadges(newStatus, _uiState.value.tasks, "shop_buy")
            saveUserData()
            return true
        }
        return false
    }

    // MÉTODOS PADRÃO
    fun dismissBadgeDialog() { _uiState.update { it.copy(showBadgeDialog = false) } }
    fun dismissLevelUpDialog() { _uiState.update { it.copy(showLevelUpDialog = false) } }

    fun login(email: String, pass: String) {
        if (email.isBlank() || pass.isBlank()) return
        _uiState.update { it.copy(isLoading = true) }
        auth.signInWithEmailAndPassword(email, pass).addOnCompleteListener { task ->
            if (task.isSuccessful) loadUserData() else _uiState.update { it.copy(isLoading = false, authError = task.exception?.message) }
        }
    }
    fun register(email: String, pass: String, heroName: String) {
        if (email.isBlank() || pass.isBlank()) return
        _uiState.update { it.copy(isLoading = true) }
        auth.createUserWithEmailAndPassword(email, pass).addOnCompleteListener { task ->
            if (task.isSuccessful) {
                _uiState.update { it.copy(heroStatus = it.heroStatus.copy(heroName = heroName)) }
                saveUserData(); _uiState.update { it.copy(isLoading = false, isLoggedIn = true) }
            } else _uiState.update { it.copy(isLoading = false, authError = task.exception?.message) }
        }
    }
    fun logout() { auth.signOut(); _uiState.update { GameUiState() } }
    fun addTask(description: String, effort: EffortLevel) {
        val newTask = Task(System.currentTimeMillis(), description, effort = effort)
        _uiState.update { it.copy(tasks = it.tasks + newTask) }
        saveUserData()
    }
    fun completeTask(task: Task) {
        if (task.isCompleted) return
        val updated = task.copy(isCompleted = true)
        val updatedList = _uiState.value.tasks.map { if (it.id == task.id) updated else it }
        _uiState.update { it.copy(tasks = updatedList) }
        earnReward(updated)
        saveUserData()
    }
    fun updateDescription(task: Task, txt: String) { _uiState.update { s -> s.copy(tasks = s.tasks.map { if(it.id==task.id) task.copy(description=txt) else it }) }; saveUserData() }
    fun updateDetails(task: Task, txt: String) { _uiState.update { s -> s.copy(tasks = s.tasks.map { if(it.id==task.id) task.copy(details=txt) else it }) }; saveUserData() }
    fun addShopItem(name: String, cost: Int) { _uiState.update { it.copy(shopItems = it.shopItems + ShopItem(System.currentTimeMillis(), name, cost)) }; saveUserData() }
    fun deleteShopItem(item: ShopItem) { _uiState.update { it.copy(shopItems = it.shopItems.filter { it.id != item.id }) }; saveUserData() }

    private fun loadUserData() {
        val userId = auth.currentUser?.uid ?: return
        _uiState.update { it.copy(isLoading = true) }
        db.collection("users").document(userId).get().addOnSuccessListener { document ->
            if (document != null && document.exists()) {
                val name = document.getString("heroName") ?: "Herói"
                val level = document.getLong("level")?.toInt() ?: 1
                val xp = document.getLong("currentXp")?.toInt() ?: 0
                val xpNext = document.getLong("xpToNextLevel")?.toInt() ?: 100
                val gold = document.getLong("gold")?.toInt() ?: 0
                val classString = document.getString("heroClass") ?: "NOVICE"
                val loadedClass = try { HeroClass.valueOf(classString) } catch (e: Exception) { HeroClass.NOVICE }
                val badges = document.get("earnedBadges") as? List<String> ?: emptyList()
                val loadedStatus = HeroStatus(level, xp, xpNext, gold, name, loadedClass, badges)
                val tasksList = document.get("tasks") as? List<Map<String, Any>> ?: emptyList()
                val loadedTasks = tasksList.map { map -> Task((map["id"] as? Long) ?: 0L, (map["description"] as? String) ?: "", (map["details"] as? String) ?: "", (map["isCompleted"] as? Boolean) ?: false, EffortLevel.valueOf((map["effort"] as? String) ?: "MEDIUM")) }
                val shopList = document.get("shopItems") as? List<Map<String, Any>> ?: emptyList()
                val loadedShopItems = shopList.map { map -> ShopItem((map["id"] as? Long) ?: 0L, (map["name"] as? String) ?: "", (map["cost"] as? Long)?.toInt() ?: 0) }
                _uiState.update { it.copy(heroStatus = loadedStatus, tasks = loadedTasks, shopItems = loadedShopItems, isLoggedIn = true, isLoading = false) }
            } else { _uiState.update { it.copy(isLoggedIn = true, isLoading = false) } }
        }
    }

    private fun saveUserData() {
        val userId = auth.currentUser?.uid ?: return
        val state = _uiState.value
        val userData = hashMapOf(
            "heroName" to state.heroStatus.heroName, "level" to state.heroStatus.level, "currentXp" to state.heroStatus.currentXp, "xpToNextLevel" to state.heroStatus.xpToNextLevel, "gold" to state.heroStatus.gold,
            "heroClass" to state.heroStatus.selectedClass.name, "earnedBadges" to state.heroStatus.earnedBadges,
            "tasks" to state.tasks.map { task -> mapOf("id" to task.id, "description" to task.description, "details" to task.details, "isCompleted" to task.isCompleted, "effort" to task.effort.name) },
            "shopItems" to state.shopItems.map { item -> mapOf("id" to item.id, "name" to item.name, "cost" to item.cost) }
        )
        db.collection("users").document(userId).set(userData, SetOptions.merge())
    }

    private fun earnReward(task: Task) {
        val state = _uiState.value
        var status = state.heroStatus
        val levelMultiplier = 1 + (status.level * 0.02)
        val xpEarned = (task.effort.xp * levelMultiplier).toInt()

        var xp = status.currentXp + xpEarned
        var level = status.level
        var nextXp = status.xpToNextLevel
        var leveledUp = false

        while (xp >= nextXp) {
            level++
            xp -= nextXp
            nextXp = nextXp + 10
            leveledUp = true
        }

        val newStatus = status.copy(level = level, currentXp = xp, xpToNextLevel = nextXp, gold = status.gold + task.effort.gold)

        _uiState.update {
            it.copy(
                heroStatus = newStatus,
                showLevelUpDialog = leveledUp,
                newLevelAchieved = if(leveledUp) level else it.newLevelAchieved
            )
        }

        checkBadges(newStatus, state.tasks)
    }
}