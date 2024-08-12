import React, { useState, useEffect, useContext, useRef } from "react";
import { AuthContext } from "../Authcontext";
import { db } from "../firebase.js";
import { doc, setDoc } from "firebase/firestore";
import "../css/chatbox.css";
import FeedbackContainer from "../components/feedbackContainer.jsx";

export default function Chatbox() {
  const { userProfile } = useContext(AuthContext);
  const [chatHistory, setChatHistory] = useState([]);
  const [firstChat, setFirstChat] = useState(true);
  const [userInput, setUserInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState([]);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [inputActive, setInputActive] = useState(false);
  const handleOpenFeedback = () => setIsFeedbackOpen(true);
  const handleCloseFeedback = () => setIsFeedbackOpen(false);
  const [feedbackIndex, setFeedbackIndex] = useState(null); // Track index of feedback
  const bottomRef = useRef(null);
  const prompts = [
    "I need help with booking a place.",
    "How do I modify or cancel my reservation?",
    "Can you help me with a billing issue?",
    "How can I contact the host of my reservation?",
  ];

  const generateMessageId = () => {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  const handleFeedback = async (index, feedbackType) => {
    // Check if the bot message at the index has a messageId
    let messageId = chatHistory[index]?.messageId;

    if (!messageId) {
      // Generate a new messageId if it doesn't exist
      messageId = generateMessageId();

      // Update the chatHistory with the new messageId
      setChatHistory((prevChatHistory) =>
        prevChatHistory.map((msg, i) =>
          i === index ? { ...msg, messageId } : msg
        )
      );
    }

    try {
      const feedbackData = {
        messageId,
        goodFeedback: feedbackType === "up", // true for thumbs up, false for thumbs down
        feedbackText: "",
        timestamp: new Date(),
      };

      const docRef = doc(db, "Feedbacks", messageId);
      await setDoc(docRef, feedbackData, { merge: true });

      console.log("Feedback saved successfully");
    } catch (error) {
      console.error("Error saving feedback:", error);
    }

    // Update feedback state based on user input
    setFeedback((prevFeedback) => {
      const newFeedback = [...prevFeedback];
      newFeedback[index] = feedbackType;
      return newFeedback;
    });
    setFeedbackIndex(index); // Update feedback index
  };

  const sendMessage = async (event) => {
    event.preventDefault();
    if (loading) return;

    setLoading(true);
    setFirstChat(false);

    setChatHistory((prevChatHistory) => [
      ...prevChatHistory,
      { type: "user", text: userInput },
    ]);

    try {
      const response = await fetch("/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userInput }),
      });

      const data = await response.json();
      const formattedBotResponse = formatBotMessage(data.response);
      console.log("formattedBotResponse", formattedBotResponse);
      console.log("data.response", data.response);

      // Generate a unique messageId for the reply message
      const messageId = generateMessageId();

      // Add reply to chat history with the generated messageId
      setChatHistory((prevChatHistory) => [
        ...prevChatHistory,
        { id: messageId, type: "bot", text: formattedBotResponse },
      ]);

      setUserInput("");
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const sendPrompt = async (prompt) => {
    if (loading) return;
    setLoading(true);
    setFirstChat(false);

    // Generate a unique messageId for the prompt
    const messageId = generateMessageId();

    setChatHistory((prevChatHistory) => [
      ...prevChatHistory,
      { id: messageId, type: "user", text: prompt },
    ]);

    try {
      const response = await fetch("http://localhost:5000/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userInput: prompt }),
      });

      const data = await response.json();
      const formattedBotResponse = formatBotMessage(data.response);
      console.log("formattedBotResponse", formattedBotResponse);
      console.log("data.text", data.response);
      setChatHistory((prevChatHistory) => [
        ...prevChatHistory,
        { id: generateMessageId(), type: "bot", text: formattedBotResponse },
      ]);
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatBotMessage = (message) => {
    // Bold text
    message = message.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    
    // Line breaks
    message = message.replace(/\n/g, "<br>");
    
    // Convert "- " bullets to <li> items with an extra line break after each item
    message = message.replace(/- (.*?)(<br>|$)/g, "<li>$1</li><br>");
    
    // Wrap <li> elements in <ul> if they exist
    if (message.includes("<li>")) {
        message = message.replace(/(<li>.*<\/li><br>)+/g, (match) => "<ul>" + match + "</ul>");
    }
    
    // Ordered list items
    message = message.replace(/(\d+)\.\s+/g, "<li>");
    message = message.replace(/<\/li><br>/g, "</li>");
    
    // Find and replace the URL pattern with the hyperlink using the text in brackets
    message = message.replace(/\[([^\]]+)\]\((https?:\/\/[^\s]+)\)/g, '<a href="$2" target="_blank">$1</a>');
  
    return message;
};

  
  useEffect(() => {
    // Scroll to the bottom of the chat history whenever it updates
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory]);

  return (
    <div id="chat-container">
      <div className="chat-header">
        <p>AI Assistant</p>
        <button>
          <i
            className="bi bi-x-lg"
            style={{ color: "#fff", fontSize: "20px" }}
          ></i>
        </button>
      </div>
      <div id="chat-main">
        <div id="chat-history">
          <div className="bot-message">
            <div>
              Hi, {userProfile?.first_name || "User"}! I’m an AI-powered
              assistant, how can I help you?
            </div>
          </div>
          {firstChat ? (
            <div id="prompt-container">
              {prompts.map((prompt, index) => (
                <button
                  onClick={() => {
                    sendPrompt(prompt);
                  }}
                  key={index}
                >
                  {prompt}
                </button>
              ))}
            </div>
          ) : null}

          {chatHistory.map((msg, index) => (
            <div key={index}>
              <div
                className={msg.type === "user" ? "user-message" : "bot-message"}
              >
                <div dangerouslySetInnerHTML={{ __html: msg.text }}></div>
              </div>
              {msg.type === "bot" && (
                <div className="feedback-container">
                  <button
                    className={`thumbs-up ${
                      feedback[index] === "up" ? "selected" : ""
                    }`}
                    onClick={() => handleFeedback(index, "up")}
                  >
                    <img
                      src="/assets/images/thumbs-up.png"
                      alt="Thumbs Up"
                      className="feedback-icon"
                    />
                  </button>
                  <button
                    className={`thumbs-down ${
                      feedback[index] === "down" ? "selected" : ""
                    }`}
                    onClick={() => handleFeedback(index, "down")}
                  >
                    <img
                      src="/assets/images/thumbs-down.png"
                      alt="Thumbs Down"
                      className="feedback-icon"
                    />
                  </button>

                  {(feedback[index] === "up" || feedback[index] === "down") && (
                    <button
                      className="txt-feedback-btn"
                      onClick={() =>
                        handleOpenFeedback(index, feedback[index] === "up")
                      }
                    >
                      Tell me more
                    </button>
                  )}

                  <FeedbackContainer
                    isOpen={isFeedbackOpen && feedbackIndex === index}
                    onClose={handleCloseFeedback}
                    messageId={msg.id} // pass messageId
                    goodFeedback={feedback[index] === "up"} // pass goodFeedback
                  />
                </div>
              )}
            </div>
          ))}

          <div ref={bottomRef}></div>
          {loading && (
            <div id="loader">
              <img src="/assets/gifs/loader1.gif" alt="Loading..." />
            </div>
          )}
        </div>
        <form onSubmit={sendMessage}>
          <div
            className={`input-bar ${inputActive ? "active" : ""}`}
            onFocus={() => setInputActive(true)}
            onBlur={() => setInputActive(false)}
          >
            <input
              type="text"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder="Enter your message"
              disabled={loading}
            />
            <button className="send-btn" type="submit">
              <img src="/assets/images/send.png" alt="Send Message" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
