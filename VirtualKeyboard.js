import { layouts } from "./layouts.js";

export class VirtualKeyboard {
  constructor() {
    this.currentLayout = "full";
    this.isVisible = false;
    this.container = document.getElementById("keyboard-container");
    this.currentInput = null;
    this.layouts = layouts;
    this.isDragging = false;
    this.offsetX = 0;
    this.offsetY = 0;
    this.shiftActive = false;
    this.capsLockActive = false;

    // กำหนดคีย์และ IV สำหรับการเข้ารหัส
    this.secretKey = "1234567890abcdef1234567890abcdef"; // คีย์ความยาว 32 bytes
    this.iv = CryptoJS.lib.WordArray.random(16); // สร้าง IV ความยาว 16 bytes

    this.initialize();
  }

  async initialize() {
    try {
      this.render();
      this.initializeInputListeners();
      console.log("VirtualKeyboard initialized successfully.");
    } catch (error) {
      console.error("Error initializing VirtualKeyboard:", error);
    }
  }

  encodeText(text) {
    const encrypted = CryptoJS.AES.encrypt(
      text,
      CryptoJS.enc.Hex.parse(this.secretKey),
      {
        iv: this.iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7,
      }
    );
    return {
      encrypted: encrypted.ciphertext.toString(CryptoJS.enc.Base64),
      iv: this.iv.toString(CryptoJS.enc.Base64),
    };
  }

  decodeText(encryptedData) {
    if (!encryptedData || !encryptedData.encrypted || !encryptedData.iv) {
      if (encryptedData === "\t") {
        return "\t";
      } else {
        return " ";
      }
    }

    try {
      const decrypted = CryptoJS.AES.decrypt(
        { ciphertext: CryptoJS.enc.Base64.parse(encryptedData.encrypted) },
        CryptoJS.enc.Hex.parse(this.secretKey),
        {
          iv: CryptoJS.enc.Base64.parse(encryptedData.iv),
          mode: CryptoJS.mode.CBC,
          padding: CryptoJS.pad.Pkcs7,
        }
      );
      return decrypted.toString(CryptoJS.enc.Utf8);
    } catch (error) {
      console.error("Error decoding text:", error);
      return " ";
    }
  }

  getLayoutName(layout) {
    switch (layout) {
      case "full":
        return "Full Keyboard";
      case "en":
        return "English Keyboard";
      case "enSc":
        return "English scrambled";
      case "th":
        return "Thai keyboard";
      case "thSc":
        return "Thai scrambled";
      case "numpad":
        return "Numpad Keyboard";
      case "scNum":
        return "Scrambled Keyboard";
      default:
        return "Unknown Layout";
    }
  }

  initializeInputListeners() {
    document.addEventListener("click", (e) => {
      const target = e.target;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
        this.setCurrentInput(target);
      }
    });

    document.addEventListener(
      "focus",
      (e) => {
        const target = e.target;
        if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
          this.setCurrentInput(target);
        }
      },
      true
    );

    const toggle = document.getElementById("toggle");
    if (toggle) {
      toggle.addEventListener("click", this.toggle.bind(this));
    }
  }

  setCurrentInput(inputElement) {
    if (this.currentInput) {
      this.currentInput.classList.remove("keyboard-active");
    }

    this.currentInput = inputElement;
    this.currentInput.classList.add("keyboard-active");
  }

  render() {
    const keyboard = document.createElement("div");
    keyboard.className = `virtual-keyboard ${this.currentLayout}`;
    keyboard.style.display = this.isVisible ? "block" : "none";
    keyboard.id = "keyboard";

    const controlsContainer = document.createElement("div");
    controlsContainer.className = "controls";
    controlsContainer.style.display = "flex";
    controlsContainer.style.justifyContent = "center";
    controlsContainer.style.alignItems = "center";
    controlsContainer.style.marginBottom = "10px";

    const layoutSelector = document.createElement("select");
    layoutSelector.id = "layout-selector";
    layoutSelector.onchange = (e) => this.changeLayout(e.target.value);

    const layouts = ["full", "en", "enSc", "th", "thSc", "numpad", "scNum"];
    layouts.forEach((layout) => {
      const option = document.createElement("option");
      option.value = layout;
      option.innerText = this.getLayoutName(layout);
      layoutSelector.appendChild(option);
    });
    layoutSelector.value = this.currentLayout;
    controlsContainer.appendChild(layoutSelector);

    keyboard.appendChild(controlsContainer);

    const layout = this.layouts[this.currentLayout];

    layout.forEach((row) => {
      const rowElement = document.createElement("div");
      rowElement.className = "keyboard-row";

      row.forEach((key, index) => {
        const keyElement = document.createElement("button");
        keyElement.className = "keyboard-key key";
        keyElement.textContent = key;
        keyElement.type = "button";

        keyElement.dataset.key = key;

        if (index >= row.length - 4) {
          keyElement.classList.add("concat-keys");
        }

        if (key === "Space") {
          keyElement.className += " space";
        }

        if (key === "backspace" || key === "Backspace") {
          keyElement.className += " backspacew";
          keyElement.innerHTML = '<i class="fa fa-backspace"></i>';
        }

        keyElement.onclick = (e) => {
          e.preventDefault();
          const keyPressed = keyElement.dataset.key || keyElement.textContent;
          if (keyPressed) {
            this.handleKeyPress(keyPressed);
          } else {
            console.error("The key element does not have a valid key value.");
          }
        };

        rowElement.appendChild(keyElement);
      });

      keyboard.appendChild(rowElement);
    });

    this.container.innerHTML = "";
    this.container.appendChild(keyboard);

    if (this.currentLayout === "scNum") {
      this.scrambleKeyboard();
    }

    if (this.currentLayout === "enSc") {
      this.scrambleEnglishKeys();
    }

    if (this.currentLayout === "thSc") {
      this.scrambleThaiKeys();
    }

    keyboard.addEventListener("mousedown", (event) => this.startDrag(event));
  }

  async handleKeyPress(keyPressed) {
    if (!this.currentInput) return;

    const start = this.currentInput.selectionStart;
    const end = this.currentInput.selectionEnd;
    const value = this.currentInput.value;

    const isCapsActive = this.capsLockActive;
    const isShiftActive = this.shiftActive;

    const convertToCorrectCase = (char) => {
      if (isCapsActive || isShiftActive) {
        return char.toUpperCase();
      }
      return char.toLowerCase();
    };

    if (!keyPressed) {
      console.error("Invalid key pressed.");
      return;
    }

    switch (keyPressed) {
      case "Esc":
        // ปิดหน้าต่างป๊อปอัพหรือยกเลิกการทำงานปัจจุบัน
        const modals = document.querySelectorAll(".modal");
        if (modals.length === 0) {
          document.exitFullscreen();
          console.warn("No modals found to close.");
        }
        modals.forEach((modal) => {
          modal.classList.add("hidden"); // ซ่อน modal
        });
        break;

      case "F1":
        break;

      case "F2":
        // เปิดโหมดแก้ไขสำหรับ element ที่เลือก
        const activeElement = document.activeElement;
        if (activeElement && activeElement.contentEditable !== undefined) {
          activeElement.contentEditable = true;
          activeElement.focus();
          console.log(activeElement.contentEditable);
        } else {
          console.warn("No editable element found.");
        }
        break;

      case "F3":
        // เปิดการค้นหา
        event.preventDefault();
        this.option.openSearch();
        break;

      case "F4":
        // เปิดเมนูการตั้งค่า
        event.preventDefault();
        this.option.openSettings();
        break;

      case "F5":
        // รีโหลดหน้าเว็บ (คงเดิม)
        window.location.reload();
        break;

      case "F6":
        // สลับระหว่างโหมดกลางวัน/กลางคืน
        document.body.classList.toggle("dark-mode");
        break;

      case "F7":
        break;

      case "F8":
        break;

      case "F9":
        break;

      case "F10":
        break;

      case "F11":
        if (!document.fullscreenElement) {
          document.documentElement
            .requestFullscreen()
            .catch((err) =>
              console.error("Error attempting to enable fullscreen:", err)
            );
        } else {
          document
            .exitFullscreen()
            .catch((err) =>
              console.error("Error attempting to exit fullscreen:", err)
            );
        }
        break;

      case "F12":
        break;

      case "HOME":
        this.currentInput.setSelectionRange(Math.max(0, 0), Math.max(0, 0));
        break;

      case "END":
        const length = this.currentInput.value.length;
        this.currentInput.setSelectionRange(length, length);
        break;

      case "Backspace":
      case "backspace":
        if (start === end && start > 0) {
          this.currentInput.value =
            value.slice(0, start - 1) + value.slice(end);
          this.currentInput.selectionStart = this.currentInput.selectionEnd =
            start - 1;
        } else {
          this.currentInput.value = value.slice(0, start) + value.slice(end);
          this.currentInput.selectionStart = this.currentInput.selectionEnd =
            start;
        }
        break;

      case "DEL⌦":
        if (start === end && start < value.length) {
          this.currentInput.value =
            value.slice(0, start) + value.slice(end + 1);
          this.currentInput.selectionStart = this.currentInput.selectionEnd =
            start;
        } else {
          this.currentInput.value = value.slice(0, start) + value.slice(end);
          this.currentInput.selectionStart = this.currentInput.selectionEnd =
            start;
        }
        break;

      case "Space":
        await this.insertText(" ");
        break;

      case "Tab ↹":
        await this.insertText("\t");
        break;

      case "Enter":
        if (this.currentInput.tagName === "TEXTAREA") {
          this.currentInput.value =
            value.slice(0, start) + "\n" + value.slice(end);
          this.currentInput.setSelectionRange(start + 1, start + 1);
        } else if (
          this.currentInput.tagName === "INPUT" ||
          this.currentInput.type === "password" ||
          this.currentInput.type === "text"
        ) {
          if (this.currentInput.form) {
            const submitButton = this.currentInput.form.querySelector(
              'input[type="submit"], button[type="submit"], button[type="button"], button[onclick]'
            );
            if (submitButton) {
              submitButton.click();
            } else {
              this.currentInput.form.submit();
            }
          } else {
            this.currentInput.value += "\n";
          }
        }
        break;

      case "Caps 🄰":
        this.toggleCapsLock();
        break;

      case "Shift ⇧":
        this.toggleShift();
        break;

      case "←":
        this.currentInput.setSelectionRange(
          Math.max(0, start - 1),
          Math.max(0, start - 1)
        );
        break;

      case "→":
        this.currentInput.setSelectionRange(start + 1, start + 1);
        break;

      case "↑":
      case "↓":
        const text = this.currentInput.value;
        const lines = text.substring(0, start).split("\n");
        const currentLineIndex = lines.length - 1;
        const currentLine = lines[currentLineIndex];
        const columnIndex = start - text.lastIndexOf("\n", start - 1) - 1;

        if (keyPressed === "↑" && currentLineIndex > 0) {
          const prevLineLength = lines[currentLineIndex - 1].length;
          const newPos =
            start -
            currentLine.length -
            1 -
            Math.min(columnIndex, prevLineLength);
          this.currentInput.setSelectionRange(newPos, newPos);
        } else if (keyPressed === "↓" && currentLineIndex < lines.length - 1) {
          const nextLine = lines[currentLineIndex + 1];
          const newPos =
            start +
            currentLine.length +
            1 +
            Math.min(columnIndex, nextLine.length);
          this.currentInput.setSelectionRange(newPos, newPos);
        }
        break;

      default:
        const encryptedText = await this.encodeText(
          convertToCorrectCase(keyPressed)
        );
        await this.insertText(encryptedText);
    }

    if (isShiftActive && !isCapsActive) {
      this.toggleShift();
    }

    this.currentInput.focus();
    const event = new Event("input", { bubbles: true });
    this.currentInput.dispatchEvent(event);
  }

  async insertText(text) {
    const start = this.currentInput.selectionStart;
    const end = this.currentInput.selectionEnd;
    const decodedText = await this.decodeText(text); // ใช้ถอดรหัสก่อนแทรก

    this.currentInput.value =
      this.currentInput.value.slice(0, start) +
      decodedText +
      this.currentInput.value.slice(end);
    this.currentInput.selectionStart = this.currentInput.selectionEnd =
      start + decodedText.length;
  }

  toggleCapsLock() {
    this.capsLockActive = !this.capsLockActive;
    document.querySelectorAll('.key[data-key="Caps 🄰"]').forEach((key) => {
      key.classList.toggle("active", this.capsLockActive);
      key.classList.toggle("bg-gray-400", this.capsLockActive);
    });

    document.querySelectorAll(".key").forEach((key) => {
      if (key.dataset.key.length === 1 && /[a-zA-Zก-๙]/.test(key.dataset.key)) {
        key.textContent = this.capsLockActive
          ? key.dataset.key.toUpperCase()
          : key.dataset.key.toLowerCase();
      }
    });

    const keyboardKeys = document.querySelectorAll(
      ".key:not([data-key='Caps 🄰'])"
    );
    keyboardKeys.forEach((key) => {
      const currentChar = key.textContent.trim();
      if (
        this.capsLockActive &&
        this.currentLayout === "th" &&
        this.ThaiAlphabetShift[currentChar]
      ) {
        key.textContent = this.ThaiAlphabetShift[currentChar];
        key.dataset.key = this.ThaiAlphabetShift[currentChar];
      } else if (
        !this.capsLockActive &&
        this.currentLayout === "th" &&
        Object.values(this.ThaiAlphabetShift).includes(currentChar)
      ) {
        // เปลี่ยนกลับเมื่อปิด Shift
        const originalKey = Object.keys(this.ThaiAlphabetShift).find(
          (key) => this.ThaiAlphabetShift[key] === currentChar
        );
        if (originalKey) {
          key.textContent = originalKey;
          key.dataset.key = originalKey;
        }
      }

      if (
        this.capsLockActive &&
        (this.currentLayout === "en" || this.currentLayout === "enSc") &&
        this.EngAlphabetShift[currentChar]
      ) {
        key.textContent = this.EngAlphabetShift[currentChar];
        key.dataset.key = this.EngAlphabetShift[currentChar];
      } else if (
        !this.capsLockActive &&
        (this.currentLayout === "en" || this.currentLayout === "enSc") &&
        Object.values(this.EngAlphabetShift).includes(currentChar)
      ) {
        const originalKey = Object.keys(this.EngAlphabetShift).find(
          (key) => this.EngAlphabetShift[key] === currentChar
        );
        if (originalKey) {
          key.textContent = originalKey;
          key.dataset.key = originalKey;
        }
      }
    });
  }

  toggleShift() {
    this.shiftActive = !this.shiftActive;
    document.querySelectorAll('.key[data-key="Shift ⇧"]').forEach((key) => {
      key.classList.toggle("active", this.shiftActive);
    });

    document.querySelectorAll(".key").forEach((key) => {
      if (key.dataset.key.length === 1 && /[a-zA-Zก-๙]/.test(key.dataset.key)) {
        key.textContent = this.shiftActive
          ? key.dataset.key.toUpperCase()
          : key.dataset.key.toLowerCase();
      }
    });

    const keyboardKeys = document.querySelectorAll(
      ".key:not([data-key='Shift ⇧'])"
    );
    keyboardKeys.forEach((key) => {
      const currentChar = key.textContent.trim();
      keyboardKeys.className += " space";
      if (
        this.shiftActive &&
        this.currentLayout === "th" &&
        this.ThaiAlphabetShift[currentChar]
      ) {
        key.textContent = this.ThaiAlphabetShift[currentChar];
        key.dataset.key = this.ThaiAlphabetShift[currentChar];
      } else if (
        !this.shiftActive &&
        this.currentLayout === "th" &&
        Object.values(this.ThaiAlphabetShift).includes(currentChar)
      ) {
        // เปลี่ยนกลับเมื่อปิด Shift
        const originalKey = Object.keys(this.ThaiAlphabetShift).find(
          (key) => this.ThaiAlphabetShift[key] === currentChar
        );
        if (originalKey) {
          key.textContent = originalKey;
          key.dataset.key = originalKey;
        }
      }

      if (
        this.shiftActive &&
        (this.currentLayout === "en" || this.currentLayout === "enSc") &&
        this.EngAlphabetShift[currentChar]
      ) {
        key.textContent = this.EngAlphabetShift[currentChar];
        key.dataset.key = this.EngAlphabetShift[currentChar];
      } else if (
        !this.shiftActive &&
        (this.currentLayout === "en" || this.currentLayout === "enSc") &&
        Object.values(this.EngAlphabetShift).includes(currentChar)
      ) {
        // เปลี่ยนกลับเมื่อปิด Shift
        const originalKey = Object.keys(this.EngAlphabetShift).find(
          (key) => this.EngAlphabetShift[key] === currentChar
        );
        if (originalKey) {
          key.textContent = originalKey;
          key.dataset.key = originalKey;
        }
      }
    });
  }

  EngAlphabetShift = {
    "`": "~",
    1: "!",
    2: "@",
    3: "#",
    4: "$",
    5: "%",
    6: "^",
    7: "&",
    8: "*",
    9: "(",
    0: ")",
    "-": "_",
    "=": "+",
    "[": "{",
    "]": "}",
    "\\": "|",
    ";": ":",
    "'": '"',
    ",": "<",
    ".": ">",
    "/": "?",
  };

  ThaiAlphabetShift = {
    _: "%",
    ๅ: "+",
    "/": "๑",
    "-": "๒",
    ภ: "๓",
    ถ: "๔",
    "ุ": "ู",
    "ึ": "฿",
    ค: "๕",
    ต: "๖",
    จ: "๗",
    ข: "๘",
    ช: "๙",
    ๆ: "๐",
    ไ: '"',
    ำ: "ฎ",
    พ: "ฑ",
    ะ: "ธ",
    "ั": "ํ",
    "ี": "๋",
    ร: "ณ",
    น: "ฯ",
    ย: "ญ",
    บ: "ฐ",
    ล: ",",
    ฃ: "ฅ",
    ฟ: "ฤ",
    ห: "ฆ",
    ก: "ฏ",
    ด: "โ",
    เ: "ฌ",
    "้": "็",
    "่": "๋",
    า: "ษ",
    ส: "ศ",
    ว: "ซ",
    ง: ".",
    ผ: "(",
    ป: ")",
    แ: "ฉ",
    อ: "ฮ",
    "ิ": "ฺ",
    "ื": "์",
    ท: "?",
    ม: "ฒ",
    ใ: "ฬ",
    ฝ: "ฦ",
  };

  toggle() {
    this.isVisible = !this.isVisible;
    this.render();
  }

  changeLayout(layout) {
    this.currentLayout = layout;
    this.render();
  }

  shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  scrambleKeyboard() {
    const keys = document.querySelectorAll(
      ".key:not([data-key=backspace]):not([data-key='+']):not([data-key='-']):not([data-key='*']):not([data-key='/']):not([data-key='%']):not([data-key='=']):not([data-key='.']):not([data-key='(']):not([data-key=')']):not([data-key='_'])"
    );
    const numbers = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];
    this.shuffleArray(numbers);
    keys.forEach((key, index) => {
      key.textContent = numbers[index];
      key.dataset.key = numbers[index];
    });
  }

  scrambleEnglishKeys() {
    const keys = document.querySelectorAll(
      ".key:not([data-key='Space']):not([data-key='Backspace']):not([data-key='Caps 🄰']):not([data-key='Shift ⇧']):not([data-key='Enter']):not([data-key='Tab ↹']):not([data-key='`']):not([data-key='1']):not([data-key='2']):not([data-key='3']):not([data-key='4']):not([data-key='5']):not([data-key='6']):not([data-key='7']):not([data-key='8']):not([data-key='9']):not([data-key='0']):not([data-key='-']):not([data-key='+']):not([data-key='=']):not([data-key='~']):not([data-key='!']):not([data-key='@']):not([data-key='#']):not([data-key='$']):not([data-key='%']):not([data-key='^']):not([data-key='&']):not([data-key='*']):not([data-key='(']):not([data-key=')']):not([data-key='_'])"
    );
    const englishAlphabet = "abcdefghijklmnopqrstuvwxyz".split("");
    this.shuffleArray(englishAlphabet);
    keys.forEach((key, index) => {
      key.textContent = englishAlphabet[index];
      key.dataset.key = englishAlphabet[index];
    });
  }

  scrambleThaiKeys() {
    const keys = document.querySelectorAll(
      ".key:not([data-key='Backspace']):not([data-key='Caps 🄰']):not([data-key='Shift ⇧']):not([data-key='Enter']):not([data-key='Space'])"
    );
    const ThaiAlphabet = "กขฃคฅฆงจฉชซฌญฎฏฐฑฒณดตถทธนบปผฝพฟภมยรฤลฦวศษสหฬอฮ".split(
      ""
    );
    this.shuffleArray(ThaiAlphabet); // สับเปลี่ยนลำดับของตัวอักษร

    keys.forEach((key, index) => {
      // อัพเดต textContent และ dataset.key ให้ตรงกับค่าใหม่ที่สับเปลี่ยน
      key.textContent = ThaiAlphabet[index];
      key.dataset.key = ThaiAlphabet[index]; // อัพเดต dataset.key ด้วยค่าใหม่
    });
  }

  // จัดการการลากคีย์บอร์ด
  startDrag(event) {
    this.isDragging = true;
    this.offsetX =
      event.clientX - document.getElementById("keyboard").offsetLeft;
    this.offsetY =
      event.clientY - document.getElementById("keyboard").offsetTop;

    document.addEventListener("mousemove", this.drag.bind(this)); // Use bind to preserve `this` context
    document.addEventListener("mouseup", () => {
      this.isDragging = false;
      document.removeEventListener("mousemove", this.drag.bind(this));
    });
  }

  drag(event) {
    if (this.isDragging) {
      const keyboard = document.getElementById("keyboard");
      keyboard.style.left = `${event.clientX - this.offsetX}px`;
      keyboard.style.top = `${event.clientY - this.offsetY}px`;
    }
  }
}
