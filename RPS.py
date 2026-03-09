import cv2
import mediapipe as mp
import numpy as np
import random
import time

# ---------------- SETUP ----------------
cap = cv2.VideoCapture(0)

mp_hands = mp.solutions.hands
mp_draw = mp.solutions.drawing_utils

hands = mp_hands.Hands(
    max_num_hands=1,
    min_detection_confidence=0.7,
    min_tracking_confidence=0.7
)

# Game variables
choices = ["ROCK", "PAPER", "SCISSORS"]
player_score = 0
ai_score = 0
result_text = ""
ai_choice = ""

# Timer variables
round_delay = 3        # seconds between rounds
show_timer = False
timer_start = 0

# ---------------- HELPER FUNCTIONS ----------------
def fingers_up(hand):
    tips = [8, 12, 16, 20]
    pips = [6, 10, 14, 18]
    fingers = []

    for tip, pip in zip(tips, pips):
        fingers.append(hand.landmark[tip].y < hand.landmark[pip].y)

    return fingers  # [index, middle, ring, pinky]


def get_player_choice(fingers):
    if fingers == [False, False, False, False]:
        return "ROCK"
    elif fingers == [True, True, True, True]:
        return "PAPER"
    elif fingers == [True, True, False, False]:
        return "SCISSORS"
    else:
        return None


def get_winner(player, ai):
    if player == ai:
        return "DRAW"
    if (player == "ROCK" and ai == "SCISSORS") or \
       (player == "SCISSORS" and ai == "PAPER") or \
       (player == "PAPER" and ai == "ROCK"):
        return "PLAYER"
    return "AI"


# ---------------- MAIN LOOP ----------------
while True:
    success, frame = cap.read()
    if not success:
        break

    frame = cv2.flip(frame, 1)
    h, w, _ = frame.shape

    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    results = hands.process(rgb)

    player_choice = None

    if results.multi_hand_landmarks:
        for hand in results.multi_hand_landmarks:
            mp_draw.draw_landmarks(frame, hand, mp_hands.HAND_CONNECTIONS)

            fingers = fingers_up(hand)
            player_choice = get_player_choice(fingers)

            if player_choice and not show_timer:
                cv2.putText(frame,
                            f"Your Move: {player_choice}",
                            (10, 60),
                            cv2.FONT_HERSHEY_SIMPLEX,
                            1,
                            (0, 255, 0),
                            2)

    current_time = time.time()

    # ---------------- TIMER LOGIC ----------------
    if show_timer:
        elapsed = current_time - timer_start
        remaining = round_delay - int(elapsed)

        if remaining <= 0:
            show_timer = False
            result_text = ""
            ai_choice = ""
        else:
            cv2.putText(frame,
                        f"Next round in: {remaining}",
                        (350, 100),
                        cv2.FONT_HERSHEY_SIMPLEX,
                        1,
                        (0, 255, 255),
                        3)

    # ---------------- GAME LOGIC ----------------
    elif player_choice:
        ai_choice = random.choice(choices)
        winner = get_winner(player_choice, ai_choice)

        if winner == "PLAYER":
            player_score += 1
            result_text = "YOU WIN!"
        elif winner == "AI":
            ai_score += 1
            result_text = "AI WINS!"
        else:
            result_text = "DRAW!"

        show_timer = True
        timer_start = current_time

    # ---------------- UI ----------------
    cv2.rectangle(frame, (0, 0), (w, 120), (0, 0, 0), -1)

    cv2.putText(frame,
                f"Player: {player_score}",
                (10, 30),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.8,
                (255, 255, 255),
                2)

    cv2.putText(frame,
                f"AI: {ai_score}",
                (200, 30),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.8,
                (255, 255, 255),
                2)

    if ai_choice:
        cv2.putText(frame,
                    f"AI Move: {ai_choice}",
                    (10, 90),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.8,
                    (0, 255, 255),
                    2)

    if result_text:
        cv2.putText(frame,
                    result_text,
                    (350, 60),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    1,
                    (0, 0, 255),
                    3)

    cv2.putText(frame,
                "Show hand | Q to quit",
                (10, h - 10),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.6,
                (255, 255, 255),
                2)

    cv2.imshow("AI Rock Paper Scissors", frame)

    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

# ---------------- CLEANUP ----------------
cap.release()
cv2.destroyAllWindows()