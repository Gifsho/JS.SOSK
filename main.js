import { VirtualKeyboard } from './VirtualKeyboard.js';

window.onload = () => {
    try {
        window.keyboard = new VirtualKeyboard();
        console.log("VirtualKeyboard initialized successfully.");
    } catch (error) {
        console.error("Error initializing VirtualKeyboard:", error);
    }
};
