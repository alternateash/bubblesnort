document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const inputStringElement = document.getElementById('input-string');
    const algorithmSelectElement = document.getElementById('algorithm-select');
    const speedSliderElement = document.getElementById('speed-slider');
    const resetButtonElement = document.getElementById('reset-button');
    const startButtonElement = document.getElementById('start-button');
    const warningElement = document.getElementById('warning');
    const statusDisplayElement = document.getElementById('status');
    const svgElement = document.getElementById('svg-visualization');
    const currentVisualStateElement = document.getElementById('current-visual-state');
    const outputLogElement = document.getElementById('output-log');
    const codeDisplayElement = document.getElementById('code-display');
    const comparisonInfoEl = document.getElementById('comparison-info'); // *** NEW Reference ***

    // --- State Variables ---
    let currentArray = [];
    let originalString = '';
    let animationSteps = []; // Stores { action, indices, arrayState, message, codeLine }
    let currentStepIndex = 0;
    let animationSpeed = parseInt(speedSliderElement.value, 10);
    let timeoutId = null;
    let isAnimating = false;
    let svgElements = { rects: [], texts: [] }; // To hold references to SVG objects
	let highlightedLineElement = null; // <<< ADD THIS LINE HERE

    const SVG_WIDTH = 600;
    const SVG_HEIGHT = 100; // Adjusted height
    const ELEMENT_WIDTH = 40;
    const ELEMENT_GAP = 10;

    // --- C Code Snippets (Relevant parts only) ---
    const codeSnippets = {
        seq_sort: `
void seq_sort(char *str)
{
    int i, j;
    i = 0;                               // Line 4
    while (str[i])                     // Line 5
    {
        j = i + 1;                     // Line 7
        while (str[j])                 // Line 8
        {
            if(str[i] > str[j])        // Line 10
                swap(&str[i], &str[j]);// Line 11
            j++;                       // Line 12
        }
        i++;                           // Line 14
    }
}
        `.trim(), // Use trim() to remove leading/trailing whitespace

        bubble_sort: `
void bubble_snort(char *str, int count)
{
    int i;
    int j;

    i = 0;                               // Line 6
    while (i < count - 1)              // Line 7
    {
        j = 0;                         // Line 9
        while (j < count - i - 1)      // Line 10
        {
            if (str[j] > str[j + 1])   // Line 12
            {
                 swap(&str[j], &str[j + 1]);// Line 14
            }
            j++;                       // Line 16
        }
        i++;                           // Line 18
    }
}
        `.trim()
    };

    // --- Event Listeners ---
    resetButtonElement.addEventListener('click', loadAndReset);
    startButtonElement.addEventListener('click', startAnimation);
    speedSliderElement.addEventListener('input', () => {
        animationSpeed = parseInt(speedSliderElement.value, 10);
        // Optional: Adjust speed mid-animation if desired (more complex)
    });
    algorithmSelectElement.addEventListener('change', loadAndReset); // Reset when algorithm changes

    // --- Initialization ---
    loadAndReset(); // Initial setup

    // --- Core Functions ---

    function escapeHtml(unsafe) {
        return unsafe
             .replace(/&/g, "&")
             .replace(/</g, "<")
             .replace(/>/g, ">")
			 .replace(/"/g, "&quot;")
             .replace(/'/g, "'");
     }

	function displayCode() {
		const selectedAlgorithm = algorithmSelectElement.value;
		const code = codeSnippets[selectedAlgorithm] || 'Code not available.';

		// Simple line numbering (optional, but helps map steps)
		const lines = code.split('\n');
		const numberedCode = lines.map((line, index) => {
			// Attempt to extract original line number from comments like // Line X
			const match = line.match(/\/\/\s*Line\s*(\d+)/);
			const displayLineNumber = match ? match[1] : index + 1; // Fallback to array index + 1
			// Remove the comment itself before displaying
			const cleanLine = line.replace(/\s*\/\/\s*Line\s*\d+/, '');
			// Simple syntax highlighting (can be expanded)
			let highlightedLine = escapeHtml(cleanLine) // Make sure escapeHtml is defined before this!
				.replace(/\b(void|int|char|while|if)\b/g, '<span class="code-keyword">$&</span>') // Keywords
				.replace(/(\/\/.*)/g, '<span class="code-comment">$&</span>') // Comments
				.replace(/(\d+)/g, '<span class="code-number">$&</span>'); // Numbers

			return `<span class="code-line" data-line-number="${displayLineNumber}"><span class="line-number">${displayLineNumber}:</span>${highlightedLine}</span>`;
		}).join('');

		codeDisplayElement.innerHTML = numberedCode;
	}

    function loadAndReset() {
        console.log("--- loadAndReset called ---"); // <<< LOG START
        clearTimeout(timeoutId); // Stop any ongoing animation
        isAnimating = false;
        currentStepIndex = 0;
        animationSteps = [];
        updateComparisonInfo(""); // *** for comparing indices  ***

        // Explicitly re-enable controls (fix from before)
        resetButtonElement.disabled = false;
        algorithmSelectElement.disabled = false;

        originalString = inputStringElement.value.trim();
        console.log("Original String:", originalString); // <<< LOG INPUT
        warningElement.textContent = '';
        outputLogElement.textContent = ''; // Clear log
        clearCodeHighlight(); // Clear highlight on reset

        // Validation
        if (!originalString) {
            console.log("Validation Failed: No string entered."); // <<< LOG VALIDATION
            statusDisplayElement.textContent = 'Please enter a string.';
            startButtonElement.disabled = false; // Disable start if no input
            clearVisualization();
            displayCode();
            resetButtonElement.disabled = false; // Ensure controls enabled
            algorithmSelectElement.disabled = false;
            return;
        }

        // Length checks (slightly simplified logic)
        if (originalString.length > 15) {
             console.log("Validation Failed: String too long (> 15)."); // <<< LOG VALIDATION
            statusDisplayElement.textContent = 'String too long for visualization.';
             warningElement.textContent = 'Warning: Long strings may render slowly.';
            startButtonElement.disabled = true; // Disable start if too long
            clearVisualization();
            displayCode();
            resetButtonElement.disabled = false; // Ensure controls enabled
            algorithmSelectElement.disabled = false;
            return;
        } else if (originalString.length > 10) {
             warningElement.textContent = 'Warning: Long strings may render slowly.';
        }


        currentArray = originalString.split('');
        console.log("Current Array:", currentArray); // <<< LOG ARRAY

        try { // Use try...catch to detect errors during drawing/setup
            console.log("Calling displayCode..."); // <<< LOG BEFORE displayCode
            displayCode();
            console.log("displayCode finished. Calling drawArray..."); // <<< LOG BEFORE drawArray
            drawArray(currentArray);
            console.log("drawArray finished."); // <<< LOG AFTER drawArray

            statusDisplayElement.textContent = `Ready to sort "${originalString}" using ${getSelectedAlgorithmName()}. Press Start.`;
            currentVisualStateElement.textContent = `Initial: [${currentArray.join(', ')}]`;

            console.log("Attempting to enable Start button..."); // <<< LOG BEFORE ENABLE
            startButtonElement.disabled = false; // *** This is the key line ***
            console.log("Start button enabled state:", startButtonElement.disabled); // <<< LOG AFTER ENABLE

        } catch (error) {
            console.error("Error during load/draw phase:", error); // <<< LOG ERROR
            statusDisplayElement.textContent = "Error loading visualization. Check console (F12).";
            startButtonElement.disabled = true; // Ensure start is disabled on error
        }


        // Ensure controls are enabled at the end regardless
        resetButtonElement.disabled = false;
        algorithmSelectElement.disabled = false;
        console.log("--- loadAndReset finished ---"); // <<< LOG END
    }

    function updateComparisonInfo(text) {
        // Check if the element exists before trying to set textContent
        if (comparisonInfoEl) {
             comparisonInfoEl.textContent = text;
        } else {
            console.warn("Comparison info element not found!");
        }
    }

	function getSelectedAlgorithmName() {
		const selectedOption = algorithmSelectElement.options[algorithmSelectElement.selectedIndex];
		// Add a check in case the element or options are somehow missing
		if (!selectedOption) {
			console.warn("Could not find selected option in algorithm select element.");
			return 'Unknown Algorithm';
		}
		return selectedOption.text; // Return the text displayed in the dropdown
	}

    function startAnimation() {
        if (isAnimating) return;

        isAnimating = true;
        startButtonElement.disabled = false;
        resetButtonElement.disabled = false; // Disable reset during animation
        algorithmSelectElement.disabled = true; // Disable selection during animation
        outputLogElement.textContent = ''; // Clear log for new run
        currentStepIndex = 0;

        statusDisplayElement.textContent = `Sorting with ${getSelectedAlgorithmName()}...`;

        // Generate the steps based on the selected algorithm
        const selectedAlgorithm = algorithmSelectElement.value;
        animationSteps = []; // Clear previous steps
        const arrayCopy = [...currentArray]; // Work on a copy

        if (selectedAlgorithm === 'seq_sort') {
            simulateSequenceSort(arrayCopy);
        } else if (selectedAlgorithm === 'bubble_sort') {
            simulateBubbleSort(arrayCopy);
        } else {
            console.error("Unknown algorithm selected");
            isAnimating = false; // Abort
            loadAndReset();
            return;
        }

        // Add a final "sorted" step
        animationSteps.push({
            action: 'final',
            arrayState: [...animationSteps[animationSteps.length - 1]?.arrayState || currentArray], // Use last known state
            message: `Sorting complete. Final array: [${(animationSteps[animationSteps.length - 1]?.arrayState || currentArray).join(', ')}]`,
            indices: [],
            codeLine: -1 // No specific code line for final state
        });

        playNextStep();
    }

    function playNextStep() {
        if (currentStepIndex >= animationSteps.length || !isAnimating) {
            isAnimating = false;
            startButtonElement.disabled = false; // Re-enable start only if needed? Usually reset is better.
            resetButtonElement.disabled = false;
            algorithmSelectElement.disabled = false;
            statusDisplayElement.textContent = `Sorting finished. Final array: [${currentArray.join(', ')}]`;
            if (currentStepIndex > 0 && animationSteps[currentStepIndex-1]) {
                 drawArray(animationSteps[currentStepIndex-1].arrayState, { final: true }); // Highlight all as sorted
            } else {
                drawArray(currentArray, { final: true}); // Fallback if no steps
            }
            highlightCodeLine(-1); // Remove code highlight
            return;
        }

        const step = animationSteps[currentStepIndex];

        // Update comparison info display
        if (step.comparisonData) {
            updateComparisonInfo(step.comparisonData);
        } else if (step.action === 'swap') {
             // Optionally show swapping info, or keep previous compare info? Or clear?
             // Let's clear it after a swap.
              updateComparisonInfo(`Swapping...`);
        } else if (step.action === 'final' || currentStepIndex === 0) {
            updateComparisonInfo(""); // Clear for final/start step
        } else {
             // For other steps like loop increments, keep the display clear or show generic message
            // updateComparisonInfo("Processing..."); // Optional generic message
            // OR Keep the previous comparison info visible until the next comparison?
            // Let's clear it for now unless it's a compare step.
             if (step.action !== 'compare') { // Clear if not explicitly compare
                 updateComparisonInfo("");
             }
        }

        // Update log
        logStep(step.message);

        // Update visualization
        drawArray(step.arrayState, { [step.action]: step.indices });

        // Update text state display
        currentVisualStateElement.textContent = `Step ${currentStepIndex + 1}: ${step.action} ${step.indices.length > 0 ? `at [${step.indices.join(', ')}]` : ''} -> [${step.arrayState.join(', ')}]`;

        // Highlight code
        highlightCodeLine(step.codeLine);

        currentStepIndex++;
        timeoutId = setTimeout(playNextStep, animationSpeed);
    }

    function logStep(message) {
        outputLogElement.textContent += message + '\n';
        outputLogElement.scrollTop = outputLogElement.scrollHeight; // Auto-scroll
    }

    // --- Simulation Functions ---

    function simulateSequenceSort(arr) {
        const n = arr.length;
        let steps = []; // Local steps for this simulation run

        steps.push({ action: 'start', indices: [], arrayState: [...arr], message: 'Starting Sequence Sort.', codeLine: 4 });

        let i = 0; // Line 4
        steps.push({ action: 'outer-loop', indices: [i], arrayState: [...arr], message: `Outer loop: i = ${i}.`, codeLine: 5 });
        while (i < n) { // Line 5 (simplified loop condition for simulation)
            let j = i + 1; // Line 7
             steps.push({ action: 'inner-loop-init', indices: [i,j], arrayState: [...arr], message: `  Inner loop: j starts at ${j}.`, codeLine: 7 });

            while (j < n) { // Line 8 (simplified loop condition)
                 steps.push({ action: 'compare', indices: [i, j], arrayState: [...arr], message: `    Comparing str[${i}] ('${arr[i]}') and str[${j}] ('${arr[j]}').`, codeLine: 10, comparisonData: `Comparing: i=${i} (val: '${arr[i]}') vs j=${j} (val: '${arr[j]}')` });
                if (arr[i] > arr[j]) { // Line 10
                    steps.push({ action: 'swap', indices: [i, j], arrayState: [...arr], message: `      Swapping str[${i}] ('${arr[i]}') and str[${j}] ('${arr[j]}').`, codeLine: 11 });
                    // Perform swap
                    [arr[i], arr[j]] = [arr[j], arr[i]];
                    steps.push({ action: 'update', indices: [i, j], arrayState: [...arr], message: `      Array now: [${arr.join(', ')}]`, codeLine: 11 });
                }
                j++; // Line 12
                steps.push({ action: 'inner-loop-increment', indices: [j-1, j], arrayState: [...arr], message: `    Increment j to ${j}.`, codeLine: 12 });
            }
             // Mark 'i' as potentially sorted (though sequence sort doesn't guarantee it like selection sort)
            steps.push({ action: 'highlight-sorted', indices: [i], arrayState: [...arr], message: `  Inner loop finished for i=${i}. Element '${arr[i]}' is in position.`, codeLine: 14 });
            i++; // Line 14
            if (i < n) {
                 steps.push({ action: 'outer-loop', indices: [i], arrayState: [...arr], message: `Increment i to ${i}.`, codeLine: 14 });
            }
        }
        animationSteps = steps; // Assign generated steps
    }


    function simulateBubbleSort(arr) {
        const n = arr.length;
        let steps = [];
        let swapped; // Optimization flag, though not in the original C code shown

        steps.push({ action: 'start', indices: [], arrayState: [...arr], message: 'Starting Bubble Sort.', codeLine: 6 });

        let i = 0; // Line 6
        steps.push({ action: 'outer-loop', indices: [i], arrayState: [...arr], message: `Outer loop (pass): i = ${i}. Sorted elements >= ${n-i}`, codeLine: 7});
        while (i < n - 1) { // Line 7
            let j = 0; // Line 9
            steps.push({ action: 'inner-loop-init', indices: [j], arrayState: [...arr], message: `  Inner loop: j starts at ${j}. Comparing adjacent elements.`, codeLine: 9});
            while (j < n - i - 1) { // Line 10
                steps.push({ action: 'compare', indices: [j, j + 1], arrayState: [...arr], message: `    Comparing str[${j}] ('${arr[j]}') and str[${j + 1}] ('${arr[j + 1]}').`, codeLine: 12, comparisonData: `Comparing: j=${j} (val: '${arr[j]}') vs j+1=${j + 1} (val: '${arr[j+1]}')` });
                if (arr[j] > arr[j + 1]) { // Line 12
                    steps.push({ action: 'swap', indices: [j, j + 1], arrayState: [...arr], message: `      Swapping str[${j}] ('${arr[j]}') and str[${j + 1}] ('${arr[j + 1]}').`, codeLine: 14 });
                    // Perform swap
                    [arr[j], arr[j + 1]] = [arr[j + 1], arr[j]];
                    steps.push({ action: 'update', indices: [j, j + 1], arrayState: [...arr], message: `      Array now: [${arr.join(', ')}]`, codeLine: 14 });
                }
                j++; // Line 16
                steps.push({ action: 'inner-loop-increment', indices: [j-1, j], arrayState: [...arr], message: `    Increment j to ${j}.`, codeLine: 16 });
            }
            // After inner loop, the element at n-i-1 is sorted
            steps.push({ action: 'highlight-sorted', indices: [n - i - 1], arrayState: [...arr], message: `  Inner loop finished for pass i=${i}. Element '${arr[n - i - 1]}' at index ${n - i - 1} is sorted.`, codeLine: 18 });

            i++; // Line 18
            if (i < n - 1) {
                 steps.push({ action: 'outer-loop', indices: [i], arrayState: [...arr], message: `Increment i to ${i}. Starting next pass.`, codeLine: 18 });
            }
        }
         // The first element is also sorted after the loop finishes
         if (n > 0) {
             steps.push({ action: 'highlight-sorted', indices: [0], arrayState: [...arr], message: `Element '${arr[0]}' at index 0 is sorted.`, codeLine: -1 }); // No specific line after loop
         }

        animationSteps = steps;
    }


    // --- Visualization/Drawing Functions ---

    function clearVisualization() {
        svgElement.innerHTML = ''; // Clear SVG content
        svgElements = { rects: [], texts: [] };
        currentVisualStateElement.textContent = '';
    }

     function drawArray(arr, highlightInfo = {}) {
        console.log("--- drawArray called with array:", arr, "and highlights:", highlightInfo); // <<< LOG START drawArray
        svgElement.innerHTML = ''; // Clear previous drawing
        svgElements = { rects: [], texts: [] }; // Reset references

        if (!arr || arr.length === 0) {
            console.warn("drawArray: Attempted to draw empty or invalid array."); // <<< LOG EMPTY ARRAY
            return; // Exit if array is empty/null
        }

        const totalWidth = arr.length * ELEMENT_WIDTH + (arr.length - 1) * ELEMENT_GAP;
        const svgActualWidth = parseInt(svgElement.getAttribute('width') || SVG_WIDTH); // Get actual width or fallback
        const svgActualHeight = parseInt(svgElement.getAttribute('height') || SVG_HEIGHT);
        console.log(`SVG dimensions: ${svgActualWidth}x${svgActualHeight}`); // <<< LOG SVG SIZE

        if(svgActualWidth <= 0 || svgActualHeight <= 0) {
             console.error("SVG has invalid dimensions (<= 0). Cannot draw."); // <<< LOG INVALID SVG SIZE
             return; // Cannot draw if SVG has no size
        }

        const startX = Math.max(ELEMENT_GAP, (svgActualWidth - totalWidth) / 2); // Center the elements, ensure padding
        const startY = (svgActualHeight - ELEMENT_WIDTH) / 2; // Center vertically
        console.log(`Calculated startX: ${startX}, startY: ${startY}`); // <<< LOG COORDS

        arr.forEach((value, index) => {
            try { // Add try...catch inside loop for finer error tracking
                const x = startX + index * (ELEMENT_WIDTH + ELEMENT_GAP);
                const y = startY;

                if (isNaN(x) || isNaN(y) || !isFinite(x) || !isFinite(y)) {
                     console.error(`Invalid coordinates calculated for index ${index}: x=${x}, y=${y}. Skipping element.`);
                     return; // continue to next iteration
                }

                // Create rectangle
                const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
                rect.setAttribute('x', x);
                rect.setAttribute('y', y);
                rect.setAttribute('width', ELEMENT_WIDTH);
                rect.setAttribute('height', ELEMENT_WIDTH); // Make it square
                rect.setAttribute('rx', 5); // Rounded corners
                rect.setAttribute('ry', 5);
                rect.setAttribute('class', 'element-rect'); // Base class
                rect.setAttribute('id', `rect-${index}`);

                // Create text
                const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
                const textX = x + ELEMENT_WIDTH / 2;
                const textY = y + ELEMENT_WIDTH / 2;

                 if (isNaN(textX) || isNaN(textY) || !isFinite(textX) || !isFinite(textY)) {
                     console.error(`Invalid text coordinates calculated for index ${index}: x=${textX}, y=${textY}. Skipping text.`);
                      // Still append rect maybe? Or skip element entirely? Let's append rect for now.
                 } else {
                    text.setAttribute('x', textX);
                    text.setAttribute('y', textY);
                 }

                text.setAttribute('class', 'element-text');
                text.setAttribute('id', `text-${index}`);
                text.textContent = value;

                // Apply highlights based on action and indices
                const { action, indices = [], sortedIndices = [] } = highlightInfo;

                if (action === 'final' || sortedIndices.includes(index)) {
                    rect.classList.add('sorted');
                } else if (indices.includes(index)) {
                    switch (action) {
                        case 'compare': case 'inner-loop-check': case 'outer-loop-check': rect.classList.add('comparing'); break;
                        case 'swap-intent': case 'swap-update': rect.classList.add('swapping'); break;
                        case 'highlight-sorted': rect.classList.add('sorted'); break;
                        case 'outer-loop': case 'inner-loop-init': case 'outer-loop-increment': case 'inner-loop-increment': rect.classList.add('comparing'); break;
                        // Add other cases if needed
                    }
                }

                svgElement.appendChild(rect);
                svgElement.appendChild(text);
                svgElements.rects.push(rect);
                svgElements.texts.push(text);

             } catch (loopError) {
                 console.error(`Error processing element at index ${index}:`, loopError); // <<< LOG LOOP ERROR
             }
        });
         console.log("--- drawArray finished drawing loop ---"); // <<< LOG END drawArray
    }

    function highlightCodeLine(targetLineNumber) {
         // Remove previous highlights
        const highlighted = codeDisplayElement.querySelector('.highlight-code');
        if (highlighted) {
            highlighted.classList.remove('highlight-code');
        }

        if (targetLineNumber > 0) {
            // Find the span corresponding to the line number
            const lineSpan = codeDisplayElement.querySelector(`.code-line[data-line-number="${targetLineNumber}"]`);
             if (lineSpan) {
                lineSpan.classList.add('highlight-code');
                // Optional: Scroll the code panel to the highlighted line
                 // lineSpan.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); // Can be jumpy
            } else {
                console.warn("Could not find code line span for line:", targetLineNumber);
            }
        }
    }

	// Add this function definition:
    function clearCodeHighlight() {
        // Check if a line element is currently stored as highlighted
        if (highlightedLineElement) {
            // Remove the highlight class from that element
            highlightedLineElement.classList.remove('highlight-code');
            // Reset the variable so we know nothing is highlighted
            highlightedLineElement = null;
        }
    }

}); // End DOMContentLoaded
