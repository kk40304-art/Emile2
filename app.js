(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const els = {
    welcome: $("welcomeScreen"), game: $("gameScreen"), start: $("startButton"), restart: $("restartButton"),
    score: $("scoreValue"), streak: $("streakValue"), progressText: $("progressText"), accuracy: $("accuracyText"),
    progressFill: $("progressFill"), lesson: $("lessonChip"), pattern: $("patternChip"), attempts: $("attemptChip"),
    prompt: $("promptHeading"), answer: $("answerLane"), answerPlaceholder: $("answerPlaceholder"), bank: $("wordBank"),
    feedback: $("feedbackPanel"), feedbackIcon: $("feedbackIcon"), feedbackTitle: $("feedbackTitle"),
    feedbackMessage: $("feedbackMessage"), reveal: $("answerReveal"), revealHanzi: $("revealHanzi"), revealPinyin: $("revealPinyin"),
    reset: $("resetButton"), check: $("checkButton"), next: $("nextButton"), finish: $("finishDialog"),
    finishSummary: $("finishSummary"), finishCorrect: $("finishCorrect"), finishStreak: $("finishStreak"), playAgain: $("playAgainButton")
  };

  const state = {
    deck: [], index: 0, attempts: 0, score: 0, streak: 0, bestStreak: 0,
    solved: false, revealed: false, initialOrder: [], drag: null
  };

  const shuffle = (items) => {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  const currentQuestion = () => state.deck[state.index];

  function answerDisplay(question) {
    if (question.display) return question.display;
    const hanzi = question.parts.map((part) => part.hanzi).join("") + question.end;
    const plainPinyin = question.parts.map((part) => part.pinyin).join(" ");
    const pinyin = plainPinyin.charAt(0).toUpperCase() + plainPinyin.slice(1) + (question.end === "？" ? "?" : ".");
    return { hanzi, pinyin };
  }

  function makeDistractors(question) {
    const targetHanzi = new Set(question.parts.map((part) => part.hanzi));
    const primary = window.HSK1_POOLS[question.pool] || [];
    const fallback = window.HSK1_POOLS.grammar;
    const candidates = [...primary, ...fallback].filter((word, index, all) =>
      !targetHanzi.has(word.hanzi) && all.findIndex((item) => item.hanzi === word.hanzi) === index
    );
    return shuffle(candidates).slice(0, 3);
  }

  function makeTile(word, answerIndex, uniqueId) {
    const tile = document.createElement("button");
    tile.type = "button";
    tile.className = "word-tile";
    tile.dataset.answerIndex = String(answerIndex);
    tile.dataset.tileId = uniqueId;
    tile.dataset.hanzi = word.hanzi;
    tile.dataset.pinyin = word.pinyin;
    tile.setAttribute("aria-label", `${word.hanzi}, ${word.pinyin}`);
    tile.innerHTML = `<span class="hanzi">${word.hanzi}</span><span class="pinyin">${word.pinyin}</span>`;
    tile.addEventListener("pointerdown", beginPointerDrag);
    tile.addEventListener("keydown", handleTileKeydown);
    return tile;
  }

  function renderQuestion() {
    const question = currentQuestion();
    state.attempts = 0;
    state.solved = false;
    state.revealed = false;

    els.lesson.textContent = question.lesson;
    els.pattern.textContent = question.label;
    els.prompt.textContent = question.english;
    els.attempts.textContent = "3 tries left";
    els.answer.className = "drop-zone answer-lane";
    els.answer.querySelectorAll(".word-tile").forEach((tile) => tile.remove());
    els.bank.innerHTML = "";
    els.reveal.hidden = true;
    els.check.hidden = false;
    els.next.hidden = true;
    els.reset.disabled = false;
    setFeedback("neutral", "Build your sentence", "Choose only the words you need.", "·");

    const targets = question.parts.map((word, index) => ({ word, answerIndex: index, id: `q${question.id}-t${index}` }));
    const extras = makeDistractors(question).map((word, index) => ({ word, answerIndex: -1, id: `q${question.id}-d${index}` }));
    const choices = shuffle([...targets, ...extras]);
    state.initialOrder = choices.map((choice) => choice.id);
    choices.forEach((choice) => els.bank.appendChild(makeTile(choice.word, choice.answerIndex, choice.id)));

    updatePlaceholders();
    updateStats();
    requestAnimationFrame(() => els.prompt.focus?.());
  }

  function updateStats() {
    const number = state.index + 1;
    els.progressText.textContent = `Question ${number} of ${state.deck.length}`;
    els.progressFill.style.width = `${(number / state.deck.length) * 100}%`;
    els.score.textContent = String(state.score);
    els.streak.textContent = String(state.streak);
    els.accuracy.textContent = `${state.score} correct`;
  }

  function updatePlaceholders() {
    els.answerPlaceholder.hidden = Boolean(els.answer.querySelector(".word-tile"));
  }

  function setFeedback(type, title, message, icon) {
    els.feedback.className = `feedback-panel${type === "neutral" ? "" : ` ${type}`}`;
    els.feedbackTitle.textContent = title;
    els.feedbackMessage.textContent = message;
    els.feedbackIcon.textContent = icon;
  }

  function resetTiles() {
    if (state.solved || state.revealed) return;
    const tiles = [...document.querySelectorAll(".word-tile")];
    tiles.sort((a, b) => state.initialOrder.indexOf(a.dataset.tileId) - state.initialOrder.indexOf(b.dataset.tileId));
    tiles.forEach((tile) => els.bank.appendChild(tile));
    els.answer.className = "drop-zone answer-lane";
    setFeedback("neutral", "Tiles reset", "Build the sentence again from the word bank.", "↻");
    updatePlaceholders();
  }

  function checkAnswer() {
    if (state.solved || state.revealed) return;
    const placed = [...els.answer.querySelectorAll(".word-tile")];
    if (!placed.length) {
      setFeedback("wrong", "No sentence yet", "Move some tiles into the answer area first.", "!");
      return;
    }

    const question = currentQuestion();
    const correct = placed.length === question.parts.length && placed.every((tile, index) => Number(tile.dataset.answerIndex) === index);
    if (correct) {
      state.solved = true;
      state.score += 1;
      state.streak += 1;
      state.bestStreak = Math.max(state.bestStreak, state.streak);
      els.answer.classList.remove("is-wrong");
      els.answer.classList.add("is-correct");
      setFeedback("correct", "Correct!", "Perfect word order. Nice work, Emile.", "✓");
      els.check.hidden = true;
      els.next.hidden = false;
      els.reset.disabled = true;
      lockTiles();
      updateStats();
      els.next.focus();
      return;
    }

    state.attempts += 1;
    state.streak = 0;
    const left = Math.max(0, 3 - state.attempts);
    els.attempts.textContent = `${left} ${left === 1 ? "try" : "tries"} left`;
    els.answer.classList.remove("is-correct");
    els.answer.classList.add("is-wrong");
    window.setTimeout(() => els.answer.classList.remove("is-wrong"), 650);

    if (state.attempts >= 3) {
      state.revealed = true;
      const display = answerDisplay(question);
      els.revealHanzi.textContent = display.hanzi;
      els.revealPinyin.textContent = display.pinyin;
      els.reveal.hidden = false;
      setFeedback("wrong", "Answer revealed", "Study the answer, then continue to the next question.", "3");
      els.check.hidden = true;
      els.next.hidden = false;
      els.reset.disabled = true;
      lockTiles();
      els.next.focus();
    } else {
      setFeedback("wrong", "Not quite yet", `Check the word order and extra tiles. You have ${left} ${left === 1 ? "try" : "tries"} left.`, "×");
    }
    updateStats();
  }

  function lockTiles() {
    document.querySelectorAll(".word-tile").forEach((tile) => {
      tile.tabIndex = -1;
      tile.setAttribute("aria-disabled", "true");
    });
  }

  function nextQuestion() {
    if (!(state.solved || state.revealed)) return;
    if (state.index >= state.deck.length - 1) {
      finishGame();
      return;
    }
    state.index += 1;
    renderQuestion();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function finishGame() {
    els.finishCorrect.textContent = `${state.score} / ${state.deck.length}`;
    els.finishStreak.textContent = String(state.bestStreak);
    els.finishSummary.textContent = `You completed all ${state.deck.length} sentences and solved ${state.score} correctly.`;
    els.finish.showModal();
  }

  function startGame() {
    state.deck = shuffle(window.HSK1_QUESTIONS);
    state.index = 0;
    state.attempts = 0;
    state.score = 0;
    state.streak = 0;
    state.bestStreak = 0;
    els.welcome.hidden = true;
    els.game.hidden = false;
    if (els.finish.open) els.finish.close();
    renderQuestion();
  }

  function restartGame() {
    if (state.index > 0 && !window.confirm("Restart with a new random order? Your current score will be cleared.")) return;
    startGame();
  }

  function beginPointerDrag(event) {
    if (state.solved || state.revealed || event.button > 0) return;
    const tile = event.currentTarget;
    tile.setPointerCapture(event.pointerId);
    state.drag = {
      tile,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
      ghost: null,
      activeZone: null
    };
    tile.addEventListener("pointermove", movePointerDrag);
    tile.addEventListener("pointerup", endPointerDrag, { once: true });
    tile.addEventListener("pointercancel", cancelPointerDrag, { once: true });
    event.preventDefault();
  }

  function movePointerDrag(event) {
    const drag = state.drag;
    if (!drag || event.pointerId !== drag.pointerId) return;
    const distance = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
    if (!drag.moved && distance > 7) {
      drag.moved = true;
      drag.tile.classList.add("drag-source");
      drag.ghost = drag.tile.cloneNode(true);
      drag.ghost.classList.add("drag-ghost");
      drag.ghost.removeAttribute("id");
      document.body.appendChild(drag.ghost);
    }
    if (!drag.moved) return;
    drag.ghost.style.left = `${event.clientX}px`;
    drag.ghost.style.top = `${event.clientY}px`;
    const below = document.elementFromPoint(event.clientX, event.clientY);
    const zone = below?.closest?.(".drop-zone") || null;
    if (drag.activeZone !== zone) {
      drag.activeZone?.classList.remove("drop-active");
      zone?.classList.add("drop-active");
      drag.activeZone = zone;
    }
    event.preventDefault();
  }

  function endPointerDrag(event) {
    const drag = state.drag;
    if (!drag || event.pointerId !== drag.pointerId) return;
    if (drag.moved) {
      const below = document.elementFromPoint(event.clientX, event.clientY);
      const zone = below?.closest?.(".drop-zone") || drag.activeZone;
      if (zone === els.answer || zone === els.bank) insertAtPointer(drag.tile, zone, event.clientX, event.clientY);
    } else {
      toggleTileZone(drag.tile);
    }
    cleanupDrag();
    updatePlaceholders();
    els.answer.classList.remove("is-wrong", "is-correct");
  }

  function cancelPointerDrag() { cleanupDrag(); }

  function cleanupDrag() {
    const drag = state.drag;
    if (!drag) return;
    drag.tile.removeEventListener("pointermove", movePointerDrag);
    drag.tile.classList.remove("drag-source");
    drag.activeZone?.classList.remove("drop-active");
    drag.ghost?.remove();
    state.drag = null;
  }

  function insertAtPointer(tile, zone, x, y) {
    const candidates = [...zone.querySelectorAll(".word-tile")].filter((item) => item !== tile);
    if (!candidates.length) {
      zone.appendChild(tile);
      return;
    }
    const nearest = candidates.reduce((best, item) => {
      const rect = item.getBoundingClientRect();
      const distance = Math.hypot(x - (rect.left + rect.width / 2), y - (rect.top + rect.height / 2));
      return !best || distance < best.distance ? { item, rect, distance } : best;
    }, null);
    const before = y < nearest.rect.top + nearest.rect.height * 0.38 ||
      (Math.abs(y - (nearest.rect.top + nearest.rect.height / 2)) < nearest.rect.height * 0.42 && x < nearest.rect.left + nearest.rect.width / 2);
    zone.insertBefore(tile, before ? nearest.item : nearest.item.nextSibling);
  }

  function toggleTileZone(tile) {
    const target = tile.parentElement === els.answer ? els.bank : els.answer;
    target.appendChild(tile);
  }

  function handleTileKeydown(event) {
    if (state.solved || state.revealed) return;
    const tile = event.currentTarget;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggleTileZone(tile);
      updatePlaceholders();
      return;
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      const previous = tile.previousElementSibling;
      if (previous?.classList.contains("word-tile")) tile.parentElement.insertBefore(tile, previous);
    }
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      const next = tile.nextElementSibling;
      if (next?.classList.contains("word-tile")) tile.parentElement.insertBefore(next, tile);
    }
  }

  els.start.addEventListener("click", startGame);
  els.restart.addEventListener("click", restartGame);
  els.reset.addEventListener("click", resetTiles);
  els.check.addEventListener("click", checkAnswer);
  els.next.addEventListener("click", nextQuestion);
  els.playAgain.addEventListener("click", startGame);
})();
