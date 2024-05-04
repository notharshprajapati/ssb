import React, { useState, useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { v4 as uuidv4 } from "uuid";
import buzzSound from "./buzz.mp3";

function App() {
  const [items, setItems] = useState([]);
  const [testStarted, setTestStarted] = useState(false);
  const [currentItem, setCurrentItem] = useState(null);
  const [timer, setTimer] = useState(null);
  const [writingPrompt, setWritingPrompt] = useState(false);
  const [paused, setPaused] = useState(false);
  const [sortedItems, setSortedItems] = useState([]);
  const buzz = new Audio(buzzSound);

  const onDrop = useCallback((acceptedFiles) => {
    acceptedFiles.forEach((file) => {
      const reader = new FileReader();

      reader.onloadend = () => {
        setItems((oldItems) => [
          ...oldItems,
          {
            id: uuidv4(),
            name: file.name,
            data: reader.result,
            type: file.type,
          },
        ]);
      };

      if (file.type.startsWith("text/")) {
        reader.onloadend = () => {
          const data = reader.result;
          const dataArray = data.split("\n");
          setItems((oldItems) => [
            ...oldItems,
            ...dataArray.map((itemData) => ({
              id: uuidv4(),
              name: file.name,
              data: itemData,
              type: file.type,
            })),
          ]);
        };
        reader.readAsText(file);
      } else {
        reader.onloadend = () => {
          setItems((oldItems) => [
            ...oldItems,
            {
              id: uuidv4(),
              name: file.name,
              data: reader.result,
              type: file.type,
            },
          ]);
        };
        reader.readAsDataURL(file);
      }
    });
  }, []);

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    multiple: true,
  });

  const startTest = () => {
    if (items.length > 0) {
      setTestStarted(true);
      setCurrentItem(items[0]);
      buzz.play(); // play the buzz sound here
    }
  };

  const endTest = () => {
    setTestStarted(false);
    setCurrentItem(null);
    setTimer(null);
  };

  const pauseTest = () => {
    setPaused(true);
  };

  const resumeTest = () => {
    setPaused(false);
  };

  const nextItem = () => {
    const currentIndex = items.findIndex((item) => item.id === currentItem.id);
    if (currentIndex < items.length - 1) {
      setCurrentItem(items[currentIndex + 1]);
    }
  };

  const previousItem = () => {
    const currentIndex = items.findIndex((item) => item.id === currentItem.id);
    if (currentIndex > 0) {
      setCurrentItem(items[currentIndex - 1]);
    }
  };

  const deleteItem = (id) => {
    setItems(items.filter((item) => item.id !== id));
  };

  const deleteAllItems = () => {
    setItems([]);
  };

  useEffect(() => {
    if (testStarted && currentItem) {
      if (currentItem.name.includes("TAT")) {
        setWritingPrompt(false); // Set writingPrompt to false when showing TAT image
        setTimer(30);
      } else if (currentItem.name.includes("WAT")) {
        setTimer(15);
      } else if (currentItem.name.includes("SRT")) {
        setTimer(30);
      }
    }
  }, [testStarted, currentItem]);

  useEffect(() => {
    let interval = null;
    if (timer > 0 && !paused) {
      interval = setInterval(() => {
        setTimer((timer) => timer - 1);
      }, 100);
    } else if (timer === 0 && !paused) {
      const currentIndex = items.findIndex(
        (item) => item.id === currentItem.id
      );
      if (currentIndex < items.length - 1) {
        if (writingPrompt) {
          setCurrentItem(items[currentIndex + 1]);
          setWritingPrompt(false);
          if (items[currentIndex + 1].name.includes("TAT")) {
            setTimer(30);
          } else if (
            items[currentIndex + 1].name.includes("WAT") ||
            items[currentIndex + 1].name.includes("SRT")
          ) {
            setTimer(15);
          }
        } else if (items[currentIndex].name.includes("TAT")) {
          // Set writingPrompt to true when timer reaches 0 for a TAT item
          setWritingPrompt(true);
          setTimer(240);
        } else {
          setCurrentItem(items[currentIndex + 1]);
          if (items[currentIndex + 1].name.includes("TAT")) {
            setTimer(30);
          } else if (
            items[currentIndex + 1].name.includes("WAT") ||
            items[currentIndex + 1].name.includes("SRT")
          ) {
            setTimer(15);
          }
        }
        buzz.play(); // play the buzz sound here
      } else {
        if (!writingPrompt && items[currentIndex].name.includes("TAT")) {
          setWritingPrompt(true);
          setTimer(240);
          buzz.play();
        } else {
          setTestStarted(false);
        }
      }
    }
    return () => clearInterval(interval);
  }, [timer, items, currentItem, paused, writingPrompt]);

  useEffect(() => {
    const newSortedItems = [...items].sort((a, b) => {
      if (a.name.includes("TAT") && !b.name.includes("TAT")) {
        return -1;
      } else if (!a.name.includes("TAT") && b.name.includes("TAT")) {
        return 1;
      } else if (a.name.includes("WAT") && b.name.includes("SRT")) {
        return -1;
      } else if (a.name.includes("SRT") && b.name.includes("WAT")) {
        return 1;
      } else {
        return 0;
      }
    });
    setSortedItems(newSortedItems);
  }, [items]);

  return (
    <div className="App bg-gray-100 min-h-screen flex items-center justify-center">
      {testStarted ? (
        <div className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4 flex flex-col">
          <div className="mb-4">
            <button
              onClick={nextItem}
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
            >
              Next
            </button>
            <button
              onClick={previousItem}
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded ml-4"
            >
              Previous
            </button>
            <button
              onClick={endTest}
              className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded ml-4"
            >
              End Test
            </button>
            {paused ? (
              <button
                onClick={resumeTest}
                className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded ml-4"
              >
                Resume Test
              </button>
            ) : (
              <button
                onClick={pauseTest}
                className="bg-yellow-500 hover:bg-yellow-700 text-white font-bold py-2 px-4 rounded ml-4"
              >
                Pause Test
              </button>
            )}
          </div>
          <div className="mb-4 text-xl font-bold">
            Time remaining: {timer} seconds
          </div>
          {writingPrompt ? (
            <div className="mb-4 text-2xl font-bold text-center">
              Write Story
            </div>
          ) : currentItem.type.startsWith("text/") ? (
            <div className="mb-4 text-2xl font-bold text-center">
              {currentItem.data}
            </div>
          ) : (
            <img
              src={currentItem.data}
              alt=""
              className="w-full object-contain"
            />
          )}
        </div>
      ) : (
        <div className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4 flex flex-col">
          <button
            {...getRootProps()}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          >
            <input {...getInputProps()} />
            Click to select files
          </button>
          <br />

          <button
            onClick={startTest}
            disabled={items.length === 0}
            className={`bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded mb-4 ${
              items.length === 0 ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            Start Test
          </button>
          <button
            onClick={deleteAllItems}
            className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded mb-4"
          >
            Delete All
          </button>
          <table className="table-auto w-full">
            <thead>
              <tr>
                <th className="px-4 py-2">File Name</th>
                <th className="px-4 py-2">Preview</th>
                <th className="px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="border px-4 py-2">{item.name}</td>
                  <td className="border px-4 py-2">
                    {item.type.startsWith("text/") ? (
                      item.data.slice(0, 100)
                    ) : (
                      <img
                        src={item.data}
                        alt=""
                        className="w-20 h-20 object-cover"
                      />
                    )}
                  </td>
                  <td className="border px-4 py-2">
                    <button
                      onClick={() => deleteItem(item.id)}
                      className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default App;
