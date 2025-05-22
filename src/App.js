import React, { useState, useCallback, useEffect, useMemo } from "react";
import { useDropzone } from "react-dropzone";
import { v4 as uuidv4 } from "uuid";
import buzzSound from "./buzz.mp3"; // Ensure this path is correct for your project structure

// Helper to create audio object once and memoize it
const useAudio = (url) => {
  return useMemo(() => new Audio(url), [url]);
};

function App() {
  const [items, setItems] = useState([]); // Raw items from dropzone
  const [sortedItems, setSortedItems] = useState([]); // Items sorted for the test

  const [testStarted, setTestStarted] = useState(false);
  const [currentItemIndex, setCurrentItemIndex] = useState(-1); // Index for sortedItems
  const [timeLeft, setTimeLeft] = useState(0); // Time remaining for current item/phase
  const [isPaused, setIsPaused] = useState(false);
  const [isWritingPhaseTAT, setIsWritingPhaseTAT] = useState(false); // True if in TAT writing phase

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
            .filter((line) => line); // Split, trim, filter empty

          const newTextItems = lines.map((line) => {
            let itemType = "text/wat"; // Default for text lines
            let namePrefix = "WAT";
            if (fileNameUpper.includes("SRT")) {
              itemType = "text/srt";
              namePrefix = "SRT";
            }
            // No specific "WAT" check for filename for WAT type, as it's the default for text lines

            return {
              id: uuidv4(),
              name: `${namePrefix}: ${line.substring(0, 30)}${line.length > 30 ? "..." : ""}`,
              data: line, // The word or sentence itself
              type: itemType,
            };
          });
          setItems((prevItems) => [...prevItems, ...newTextItems]);
        } else if (file.type.startsWith("image/")) {
          setItems((prevItems) => [
            ...prevItems,
            {
              id: uuidv4(),
              name: `TAT: ${file.name}`, // Assume images are for TAT
              data: reader.result, // Data URL for image
              type: "image/tat", // Custom type for TAT images
            },
          ]);
        } else {
          console.warn("Unsupported file type:", file.name, file.type);
        }
      };

      reader.onerror = () => {
        console.error("Error reading file:", file.name);
      };

      if (file.type.startsWith("text/")) {
        reader.readAsText(file);
      } else if (file.type.startsWith("image/")) {
        reader.readAsDataURL(file);
      }
    });
  }, []);

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    multiple: true,
    accept: {
      "text/plain": [".txt"],
      "image/jpeg": [".jpeg", ".jpg"],
      "image/png": [".png"],
    },
  });

  // Sort items whenever the raw 'items' list changes
  useEffect(() => {
    const getItemPriority = (item) => {
      const type = item.type;
      if (type === "image/tat") return 1; // TAT images first
      if (type === "text/wat") return 2; // Then WAT words
      if (type === "text/srt") return 3; // Then SRT
      return 4; // Others
    };
    const newSortedItems = [...items].sort((a, b) => getItemPriority(a) - getItemPriority(b));
    setSortedItems(newSortedItems);
  }, [items]);

  const endTestCallback = useCallback(() => {
    setTestStarted(false);
    setCurrentItemIndex(-1);
    setTimeLeft(0);
    setIsPaused(false);
    setIsWritingPhaseTAT(false);
    if (buzz && typeof buzz.pause === "function") {
      buzz.pause();
      if (buzz.currentTime !== undefined) buzz.currentTime = 0;
    }
  }, [buzz]); // buzz is stable due to useMemo

  // Effect 1: Setup current item, its timer, play sound
  useEffect(() => {
    if (!testStarted || currentItemIndex < 0 || currentItemIndex >= sortedItems.length || isPaused) {
      return;
    }

    const currentItem = sortedItems[currentItemIndex];
    if (!currentItem) {
      console.error("Current item not found, ending test.");
      endTestCallback();
      return;
    }

    if (buzz && typeof buzz.play === "function") {
      if (buzz.currentTime !== undefined) buzz.currentTime = 0;
      buzz.play().catch((e) => console.warn("Buzz sound play failed (autoplay restrictions?):", e));
    }

    let itemDuration;
    const itemType = currentItem.type;

    if (isWritingPhaseTAT) {
      itemDuration = 240; // 4 minutes for TAT Story Writing
    } else if (itemType === "image/tat") {
      itemDuration = 30; // 30 seconds for TAT Image Display
    } else if (itemType === "text/wat") {
      itemDuration = 15; // **WAT specific: 15 seconds**
    } else if (itemType === "text/srt") {
      itemDuration = 30; // Example: 30 seconds for SRT
    } else {
      itemDuration = 15; // Default duration for any other types
    }
    setTimeLeft(itemDuration);
  }, [testStarted, currentItemIndex, sortedItems, isPaused, isWritingPhaseTAT, buzz, endTestCallback]);

  // Effect 2: Countdown timer
  useEffect(() => {
    if (!testStarted || isPaused || timeLeft <= 0) {
      return;
    }
    const intervalId = setInterval(() => {
      setTimeLeft((prevTime) => prevTime - 1);
    }, 1000);
    return () => clearInterval(intervalId);
  }, [testStarted, isPaused, timeLeft]);

  // Effect 3: Handle transitions when timeLeft reaches 0
  useEffect(() => {
    if (testStarted && timeLeft === 0 && !isPaused) {
      const currentItem = sortedItems[currentItemIndex];

      if (currentItem && currentItem.type === "image/tat" && !isWritingPhaseTAT) {
        // Finished TAT image display, now start writing phase for THE SAME item
        setIsWritingPhaseTAT(true);
        // Effect 1 will pick up isWritingPhaseTAT=true and set the 240s timer & play buzz
      } else {
        // Finished WAT/SRT item, or finished TAT writing phase
        setIsWritingPhaseTAT(false); // Ensure writing phase is off for the next actual item

        if (currentItemIndex < sortedItems.length - 1) {
          setCurrentItemIndex((prevIndex) => prevIndex + 1); // Move to next actual item
        } else {
          endTestCallback(); // All items and phases are done
        }
      }
    }
  }, [testStarted, timeLeft, isPaused, currentItemIndex, sortedItems, isWritingPhaseTAT, endTestCallback]);

  const startTest = () => {
    if (sortedItems.length > 0) {
      setCurrentItemIndex(0);
      setIsWritingPhaseTAT(false);
      setIsPaused(false);
      setTestStarted(true);
      // Effect 1 will handle the first item's setup (timer, sound)
    }
  };

  const pauseTest = () => setIsPaused(true);
  const resumeTest = () => setIsPaused(false);

  const nextItem = () => {
    if (!testStarted || (currentItemIndex >= sortedItems.length - 1 && !isWritingPhaseTAT)) return;

    if (isWritingPhaseTAT && sortedItems[currentItemIndex]?.type === "image/tat") {
      // If in TAT writing phase, "Next" should end this phase and move to the next actual item
      setIsWritingPhaseTAT(false);
      if (currentItemIndex < sortedItems.length - 1) {
        setCurrentItemIndex((prevIndex) => prevIndex + 1);
      } else {
        endTestCallback();
      }
    } else if (currentItemIndex < sortedItems.length - 1) {
      setIsWritingPhaseTAT(false);
      setCurrentItemIndex((prevIndex) => prevIndex + 1);
    }
    // Effect 1 will handle new item setup
  };

  const previousItem = () => {
    if (!testStarted || currentItemIndex <= 0) return;
    setIsWritingPhaseTAT(false);
    setCurrentItemIndex((prevIndex) => prevIndex - 1);
    // Effect 1 will handle new item setup
  };

  const deleteItem = (id) => {
    if (testStarted) {
      alert("Cannot delete items while a test is in progress. Please end the test first.");
      return;
    }
    setItems((prevItems) => prevItems.filter((item) => item.id !== id));
  };

  const deleteAllItems = () => {
    if (testStarted) {
      alert("Cannot delete items while a test is in progress. Please end the test first.");
      return;
    }
    setItems([]);
  };

  const currentDisplayItem = testStarted && currentItemIndex >= 0 && currentItemIndex < sortedItems.length ? sortedItems[currentItemIndex] : null;

  return (
    <div className="App bg-gray-100 min-h-screen flex flex-col items-center justify-center p-4 font-sans">
      {testStarted && currentDisplayItem ? (
        <div className="bg-white shadow-xl rounded-lg px-6 sm:px-8 py-6 mb-4 flex flex-col w-full max-w-2xl">
          <div className="mb-4 flex flex-wrap justify-between items-center gap-2">
            <div className="flex gap-2">
              <button
                onClick={previousItem}
                disabled={currentItemIndex <= 0}
                className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50 transition-colors">
                Previous
              </button>
              <button
                onClick={nextItem}
                disabled={currentItemIndex >= sortedItems.length - 1 && !isWritingPhaseTAT}
                className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded ml-2 disabled:opacity-50 transition-colors">
                Next
              </button>
            </div>
            <div className="flex gap-2">
              {isPaused ? (
                <button
                  onClick={resumeTest}
                  className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded transition-colors">
                  Resume
                </button>
              ) : (
                <button
                  onClick={pauseTest}
                  className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-2 px-4 rounded transition-colors">
                  Pause
                </button>
              )}
              <button
                onClick={endTestCallback}
                className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded transition-colors">
                End Test
              </button>
            </div>
          </div>
          <div className="mb-4 text-xl font-semibold text-center text-gray-700">
            Time: <span className="text-blue-600">{timeLeft}s</span>
          </div>
          <div className="mb-4 text-center h-64 sm:h-80 flex items-center justify-center border-2 border-gray-300 rounded-md p-2 bg-gray-50">
            {isWritingPhaseTAT ? (
              <div className="text-2xl font-bold text-indigo-700">Write Story for TAT Image</div>
            ) : currentDisplayItem.type === "text/wat" || currentDisplayItem.type === "text/srt" ? (
              <div className="text-3xl sm:text-4xl font-bold text-gray-800 px-4">{currentDisplayItem.data}</div>
            ) : currentDisplayItem.type === "image/tat" ? (
              <img
                src={currentDisplayItem.data}
                alt={currentDisplayItem.name}
                className="max-w-full max-h-full object-contain rounded"
              />
            ) : (
              <div className="text-xl text-gray-500">Unsupported item type.</div>
            )}
          </div>
          <div className="text-sm text-gray-600 text-center">
            Item {currentItemIndex + 1} of {sortedItems.length} ({currentDisplayItem.name}) - Type: {currentDisplayItem.type}
          </div>
        </div>
      ) : (
        <div className="bg-white shadow-xl rounded-lg px-6 sm:px-8 py-6 mb-4 flex flex-col w-full max-w-3xl">
          <div
            {...getRootProps()}
            className="border-dashed border-2 border-blue-400 p-6 mb-6 text-center cursor-pointer hover:bg-blue-50 transition-colors rounded-md">
            <input {...getInputProps()} />
            <p className="text-gray-700 font-medium">Drag 'n' drop files here, or click to select.</p>
            <p className="text-sm text-gray-500 mt-1">Accepts: .txt (for WAT/SRT), .jpg, .png (for TAT).</p>
            <p className="text-xs text-gray-500 mt-1">For .txt files: each line = one item. Name like 'my_srt.txt' to auto-tag as SRT.</p>
          </div>

          {items.length > 0 && (
            <>
              <div className="mb-4 flex flex-wrap justify-between items-center gap-2">
                <button
                  onClick={startTest}
                  className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded transition-colors">
                  Start Test ({sortedItems.length} item{sortedItems.length === 1 ? "" : "s"})
                </button>
                <button
                  onClick={deleteAllItems}
                  className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded transition-colors">
                  Delete All Items
                </button>
              </div>
              <h3 className="text-lg font-semibold mb-2 text-gray-800">Uploaded Items (Test Order):</h3>
              <div className="overflow-x-auto max-h-96 border border-gray-200 rounded-md">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">#</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Preview/Name</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {sortedItems.map((item, index) => (
                      <tr
                        key={item.id}
                        className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{index + 1}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                          {item.type.startsWith("text/") ? (item.data.length > 40 ? `${item.data.slice(0, 40)}...` : item.data) : item.name.length > 40 ? `${item.name.slice(0, 40)}...` : item.name}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{item.type}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm">
                          <button
                            onClick={() => deleteItem(item.id)}
                            disabled={testStarted}
                            className="bg-red-100 hover:bg-red-200 text-red-700 font-semibold py-1 px-3 rounded text-xs disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {items.length === 0 && <p className="text-center text-gray-500 py-4">No items uploaded. Add files to begin the test setup.</p>}
        </div>
      )}
    </div>
  );
}

export default App;
