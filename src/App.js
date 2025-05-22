import React, { useState, useCallback, useEffect, useMemo, Fragment } from "react";
import { useDropzone } from "react-dropzone";
import { v4 as uuidv4 } from "uuid";
import buzzSound from "./buzz.mp3"; // Ensure this path is correct

// --- Icons (Heroicons - MIT License) ---
const EyeIcon = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    {...props}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
    />
  </svg>
);

const EyeSlashIcon = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    {...props}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.243 4.243l-4.243-4.243"
    />
  </svg>
);
// --- End Icons ---

const useAudio = (url) => {
  return useMemo(() => new Audio(url), [url]);
};

function App() {
  const [items, setItems] = useState([]);
  const [sortedItems, setSortedItems] = useState([]);

  const [testStarted, setTestStarted] = useState(false);
  const [currentItemIndex, setCurrentItemIndex] = useState(-1);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isWritingPhaseTAT, setIsWritingPhaseTAT] = useState(false);
  const [isBlindMode, setIsBlindMode] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false); // Lock for transitions

  const buzz = useAudio(buzzSound);

  const onDrop = useCallback((acceptedFiles) => {
    acceptedFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const fileNameUpper = file.name.toUpperCase();
        if (file.type.startsWith("text/")) {
          const textData = reader.result;
          const lines = textData
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter((line) => line);

          const newTextItems = lines.map((line) => {
            let itemType = "text/wat";
            let namePrefix = "WAT";
            if (fileNameUpper.includes("SRT")) {
              itemType = "text/srt";
              namePrefix = "SRT";
            }
            return { id: uuidv4(), name: `${namePrefix}: ${line}`, data: line, type: itemType };
          });
          setItems((prevItems) => [...prevItems, ...newTextItems]);
        } else if (file.type.startsWith("image/")) {
          setItems((prevItems) => [...prevItems, { id: uuidv4(), name: `TAT: ${file.name}`, data: reader.result, type: "image/tat" }]);
        } else {
          console.warn("Unsupported file type:", file.name, file.type);
        }
      };
      reader.onerror = () => console.error("Error reading file:", file.name);
      if (file.type.startsWith("text/")) reader.readAsText(file);
      else if (file.type.startsWith("image/")) reader.readAsDataURL(file);
    });
  }, []);

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    multiple: true,
    accept: { "text/plain": [".txt"], "image/jpeg": [".jpeg", ".jpg"], "image/png": [".png"] },
  });

  useEffect(() => {
    const getItemPriority = (item) => {
      if (item.type === "image/tat") return 1;
      if (item.type === "text/wat") return 2;
      if (item.type === "text/srt") return 3;
      return 4;
    };
    setSortedItems([...items].sort((a, b) => getItemPriority(a) - getItemPriority(b)));
  }, [items]);

  const endTestCallback = useCallback(() => {
    setTestStarted(false);
    setCurrentItemIndex(-1);
    setTimeLeft(0);
    setIsPaused(false);
    setIsWritingPhaseTAT(false);
    setIsTransitioning(false); // Reset transition lock
    if (buzz && typeof buzz.pause === "function") {
      buzz.pause();
      if (buzz.currentTime !== undefined) buzz.currentTime = 0;
    }
  }, [buzz]); // Removed setIsTransitioning from deps as it's stable from useState

  // Effect 1: Setup current item, its timer, play sound, release transition lock
  useEffect(() => {
    if (!testStarted || currentItemIndex < 0 || currentItemIndex >= sortedItems.length || isPaused) {
      if (isTransitioning && (!testStarted || isPaused)) {
        // Release lock if test ends/pauses during transition
        setIsTransitioning(false);
      }
      return;
    }

    const currentItem = sortedItems[currentItemIndex];
    if (!currentItem) {
      endTestCallback();
      return;
    }

    let itemDuration;
    if (isWritingPhaseTAT) itemDuration = 240;
    else if (currentItem.type === "image/tat") itemDuration = 30;
    else if (currentItem.type === "text/wat") itemDuration = 15;
    else if (currentItem.type === "text/srt") itemDuration = 30;
    else itemDuration = 15;

    setTimeLeft(itemDuration);

    if (buzz && typeof buzz.play === "function") {
      if (buzz.currentTime !== undefined) buzz.currentTime = 0;
      buzz.play().catch((e) => console.warn("Buzz play failed:", e));
    }

    if (isTransitioning) {
      // If this setup is due to a transition, release the lock
      setIsTransitioning(false);
    }
  }, [testStarted, currentItemIndex, sortedItems, isPaused, isWritingPhaseTAT, buzz, endTestCallback, isTransitioning]); // Added isTransitioning

  // Effect 2: Countdown timer
  useEffect(() => {
    if (!testStarted || isPaused || timeLeft <= 0 || isTransitioning) return; // also pause countdown during active transition
    const intervalId = setInterval(() => setTimeLeft((prevTime) => prevTime - 1), 1000);
    return () => clearInterval(intervalId);
  }, [testStarted, isPaused, timeLeft, isTransitioning]); // Added isTransitioning

  // Effect 3: Handle transitions when timeLeft reaches 0 (acquires lock)
  useEffect(() => {
    if (testStarted && timeLeft === 0 && !isPaused && !isTransitioning) {
      // Check !isTransitioning
      setIsTransitioning(true); // Acquire lock: A_S_A_P

      const currentItem = sortedItems[currentItemIndex]; // Should be valid if testStarted & index >=0

      if (currentItem && currentItem.type === "image/tat" && !isWritingPhaseTAT) {
        setIsWritingPhaseTAT(true);
        // Lock will be released by Effect 1 after setIsWritingPhaseTAT triggers it
      } else {
        setIsWritingPhaseTAT(false);
        if (currentItemIndex < sortedItems.length - 1) {
          setCurrentItemIndex((prevIndex) => prevIndex + 1);
          // Lock will be released by Effect 1 after setCurrentItemIndex triggers it
        } else {
          endTestCallback(); // This will also release the lock
        }
      }
    }
  }, [testStarted, timeLeft, isPaused, currentItemIndex, sortedItems, isWritingPhaseTAT, endTestCallback, isTransitioning]); // Added isTransitioning

  const startTest = () => {
    if (sortedItems.length > 0) {
      const firstItem = sortedItems[0];
      let initialTime = 15; // Default
      if (firstItem.type === "image/tat") initialTime = 30;
      // No need to check WAT/SRT here, image/tat is the main concern for initial `isWritingPhaseTAT`

      setTimeLeft(initialTime); // IMPORTANT: Set non-zero time before other states change
      setCurrentItemIndex(0);
      setIsWritingPhaseTAT(false);
      setIsPaused(false);
      setTestStarted(true);
      setIsTransitioning(false); // Ensure lock is clear at start
      // Effect 1 will fire due to index/testStarted change, play buzz, and confirm timeLeft.
    }
  };

  const pauseTest = () => setIsPaused(true);
  const resumeTest = () => {
    setIsPaused(false);
    // If resuming, ensure transition lock is clear if timeLeft > 0
    if (timeLeft > 0) setIsTransitioning(false);
  };

  const nextItem = () => {
    if (!testStarted || isTransitioning || (currentItemIndex >= sortedItems.length - 1 && !isWritingPhaseTAT)) return;

    setIsTransitioning(true); // Acquire lock for manual navigation too
    if (isWritingPhaseTAT && sortedItems[currentItemIndex]?.type === "image/tat") {
      setIsWritingPhaseTAT(false);
      if (currentItemIndex < sortedItems.length - 1) setCurrentItemIndex((p) => p + 1);
      else endTestCallback();
    } else if (currentItemIndex < sortedItems.length - 1) {
      setIsWritingPhaseTAT(false);
      setCurrentItemIndex((p) => p + 1);
    } else {
      endTestCallback(); // Should also release lock via endTestCallback
    }
  };

  const previousItem = () => {
    if (!testStarted || isTransitioning || currentItemIndex <= 0) return;
    setIsTransitioning(true); // Acquire lock for manual navigation
    setIsWritingPhaseTAT(false);
    setCurrentItemIndex((p) => p - 1);
  };

  const deleteItem = (id) => {
    if (testStarted) {
      alert("Cannot delete items during a test.");
      return;
    }
    setItems((prevItems) => prevItems.filter((item) => item.id !== id));
  };

  const deleteAllItems = () => {
    if (testStarted) {
      alert("Cannot delete items during a test.");
      return;
    }
    setItems([]);
  };

  const currentDisplayItem = testStarted && currentItemIndex >= 0 && currentItemIndex < sortedItems.length ? sortedItems[currentItemIndex] : null;

  const getCleanItemName = (item) => {
    if (!item || !item.name) return "";
    let name = item.name.replace(/^(TAT|WAT|SRT):\s*/, "");
    name = name.replace(/\s*-\s*$/, "").trim(); // Removes trailing " -"
    return name;
  };

  const buttonBaseStyle = "font-semibold py-2 px-4 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-opacity-50 transition-all duration-150 ease-in-out";
  const primaryButton = `${buttonBaseStyle} bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500`;
  const secondaryButton = `${buttonBaseStyle} bg-slate-200 hover:bg-slate-300 text-slate-700 focus:ring-slate-400`;
  const dangerButton = `${buttonBaseStyle} bg-red-500 hover:bg-red-600 text-white focus:ring-red-400`;
  const warningButton = `${buttonBaseStyle} bg-yellow-500 hover:bg-yellow-600 text-white focus:ring-yellow-400`;
  const successButton = `${buttonBaseStyle} bg-green-500 hover:bg-green-600 text-white focus:ring-green-400`;
  const iconButton = "p-2 rounded-full hover:bg-slate-200 text-slate-600 hover:text-slate-800 transition-colors duration-150";

  return (
    <div className="App bg-slate-100 min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 font-sans selection:bg-blue-200">
      {testStarted && currentDisplayItem ? (
        <div className="bg-white shadow-2xl rounded-xl p-6 sm:p-8 flex flex-col w-full max-w-3xl relative animate-fadeIn">
          <div className="absolute top-0 left-0 right-0 p-4 sm:p-6 flex justify-between items-center">
            <span className="text-sm sm:text-base text-slate-500 font-medium">
              Item {currentItemIndex + 1} of {sortedItems.length}
            </span>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setIsBlindMode((prev) => !prev)}
                title={isBlindMode ? "Show Timer" : "Hide Timer"}
                className={iconButton}>
                {isBlindMode ? <EyeSlashIcon className="w-5 h-5 sm:w-6 sm:h-6" /> : <EyeIcon className="w-5 h-5 sm:w-6 sm:h-6" />}
              </button>
              <button
                onClick={endTestCallback}
                className={`${dangerButton} py-1.5 px-3 text-sm`}>
                End Test
              </button>
            </div>
          </div>

          <div
            className="flex flex-col items-center justify-center mt-12 mb-8"
            style={{ minHeight: "300px" }}>
            {!isBlindMode && <div className={`mb-4 sm:mb-6 text-2xl sm:text-3xl font-bold text-blue-600 ${isTransitioning ? "opacity-50" : "animate-pulseFast"}`}>{timeLeft}s</div>}
            <div className="text-center w-full h-60 sm:h-72 flex items-center justify-center p-2 bg-slate-50 rounded-lg shadow-inner">
              {isWritingPhaseTAT ? (
                <div className="text-2xl sm:text-3xl font-semibold text-blue-700 px-4">Write Story for TAT Image</div>
              ) : currentDisplayItem.type.startsWith("text/") ? (
                <div className="text-4xl sm:text-5xl font-bold text-slate-800 px-4 break-words animate-textAppear">
                  {currentDisplayItem.data} {/* Displays raw data from file */}
                </div>
              ) : currentDisplayItem.type === "image/tat" ? (
                <img
                  src={currentDisplayItem.data}
                  alt={getCleanItemName(currentDisplayItem)}
                  className="max-w-full max-h-full object-contain rounded-md shadow-lg animate-imageAppear"
                />
              ) : (
                <div className="text-xl text-slate-500">Loading...</div>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-center items-center gap-3 sm:gap-4 pt-4 border-t border-slate-200">
            <button
              onClick={previousItem}
              disabled={currentItemIndex <= 0 || isTransitioning}
              className={`${secondaryButton} disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto`}>
              Previous
            </button>
            {isPaused ? (
              <button
                onClick={resumeTest}
                disabled={isTransitioning}
                className={`${successButton} w-full sm:w-auto disabled:opacity-50`}>
                Resume
              </button>
            ) : (
              <button
                onClick={pauseTest}
                disabled={isTransitioning}
                className={`${warningButton} w-full sm:w-auto disabled:opacity-50`}>
                Pause
              </button>
            )}
            <button
              onClick={nextItem}
              disabled={(currentItemIndex >= sortedItems.length - 1 && !isWritingPhaseTAT) || isTransitioning}
              className={`${primaryButton} disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto`}>
              Next
            </button>
          </div>
          <div className="text-xs text-slate-400 text-center mt-6">
            Displaying: {getCleanItemName(currentDisplayItem)} ({currentDisplayItem.type.split("/")[1].toUpperCase()})
          </div>
        </div>
      ) : (
        <div className="bg-white shadow-2xl rounded-xl p-6 sm:p-8 flex flex-col w-full max-w-2xl animate-fadeIn">
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-800 text-center mb-6 sm:mb-8">Psychological Test Suite</h1>
          <div
            {...getRootProps()}
            className="border-2 border-dashed border-slate-300 hover:border-blue-500 bg-slate-50 hover:bg-blue-50 p-8 sm:p-10 mb-6 sm:mb-8 text-center cursor-pointer transition-all duration-200 ease-in-out rounded-lg">
            <input {...getInputProps()} />
            <p className="text-slate-700 font-medium text-lg">Drag 'n' drop files here, or click.</p>
            <p className="text-sm text-slate-500 mt-2">Supports .txt (WAT/SRT), .jpg, .png (TAT).</p>
            <p className="text-xs text-slate-400 mt-1">Name .txt like 'my_srt_words.txt' to auto-tag as SRT.</p>
          </div>

          {items.length > 0 && (
            <Fragment>
              <div className="mb-6 flex flex-col sm:flex-row justify-between items-center gap-3">
                <button
                  onClick={startTest}
                  className={`${successButton} w-full sm:w-auto`}>
                  Start Test ({sortedItems.length} item{sortedItems.length === 1 ? "" : "s"})
                </button>
                <button
                  onClick={deleteAllItems}
                  className={`${dangerButton} w-full sm:w-auto`}>
                  {" "}
                  Delete All Items{" "}
                </button>
              </div>
              <h3 className="text-xl font-semibold mb-3 text-slate-700">Test Sequence:</h3>
              <div className="overflow-auto max-h-80 border border-slate-200 rounded-lg shadow-inner">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-100 sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">#</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Content / Name</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Action</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-200">
                    {sortedItems.map((item, index) => (
                      <tr
                        key={item.id}
                        className="hover:bg-slate-50 transition-colors duration-100">
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-600">{index + 1}</td>
                        <td
                          className="px-4 py-3 text-sm text-slate-800 max-w-xs truncate"
                          title={getCleanItemName(item)}>
                          {getCleanItemName(item)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-500">{item.type.split("/")[1].toUpperCase()}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm">
                          <button
                            onClick={() => deleteItem(item.id)}
                            disabled={testStarted}
                            className="text-red-600 hover:text-red-800 font-medium text-xs py-1 px-2 rounded hover:bg-red-100 transition-colors disabled:opacity-50">
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Fragment>
          )}
          {items.length === 0 && <p className="text-center text-slate-500 py-6">No items uploaded. Add files to prepare your test.</p>}
        </div>
      )}
    </div>
  );
}

export default App;

// CSS for animations (add to your global CSS file, e.g., index.css)
/*
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer utilities {
  .animate-fadeIn { animation: fadeIn 0.5s ease-out; }
  .animate-textAppear { animation: textAppear 0.3s ease-out forwards; }
  .animate-imageAppear { animation: imageAppear 0.4s ease-out forwards; }
  .animate-pulseFast { animation: pulseFast 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite; }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes textAppear {
    from { opacity: 0; transform: scale(0.95); }
    to { opacity: 1; transform: scale(1); }
  }
  @keyframes imageAppear {
    from { opacity: 0; transform: scale(0.9); }
    to { opacity: 1; transform: scale(1); }
  }
  @keyframes pulseFast {
    0%, 100% { opacity: 1; }
    50% { opacity: .7; }
  }
}
*/
