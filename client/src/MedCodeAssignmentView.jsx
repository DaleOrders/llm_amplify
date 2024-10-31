import {
    useState,
    useEffect,
    useRef,
    forwardRef,
    memo,
} from "react"
import Select from 'react-select'
import Creatable from 'react-select/creatable'

import validation_dict from './assets/json/validator_dict.json'

// CONSTANTS +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++

const {
    dataElemNumOptions,
    dataElemEnumerations,
    dataElemTypeConstraints
} = selectOptionsFromValidationDict()

// END CONSTANTS +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++

// MAIN VIEW COMPONENT +++++++++++++++++++++++++++++++++++++++++++++++++++++++++

export default function MedCodeAssignmentView() {
    const [$result, setResults] = useState(null)
    const [$statusMessage, setStatusMessage] = useState(
        "Press Record. When done, press Stop to upload your recording."
    )

    const [$clickedWordId, setClickedWordId] = useState(null)
    const [$selectionBoundsIds, setSelectionBoundsIds] = useState([])

    const [$entries, setEntries] = useState([])  // maps to entries form

    // transform data received from server to map to UI
    // and dump annotations into entries
    useEffect(() => {
        if ($result?.annotations) {
            const wordsArray = $result.transcript
                .split(' ')
                .map((word, id) => ({ id, value: word }))

            // mix in words array
            const transcript = { transcript: $result.transcript, wordsArray }

            // mix in the phrase bounds, ids
            const annotationsWithPhraseBounds = []
            // for (const annotation of $result.annotations) {
            $result.annotations.forEach((annotation, i) => {
                // mix in id
                annotation.id = i

                // mix in data elem name and code description
                const { data_elem_num, data_elem_val } = annotation
                annotation.data_elem_name = dataElemNameFrom(data_elem_num)
                annotation.code_description = codeDescriptionFrom(data_elem_num, data_elem_val)

                // mix in phrase bound ids
                const { phrase } = annotation
                const searchWords = phrase.trim().split(' ')
                const searchWordsLength = searchWords.length
                for (let i = 0; i <= wordsArray.length - searchWordsLength; i++) {
                    // TODO: account for punctuation bc transcription could spit anything out
                    let matches = true
                    for (let j = 0; j < searchWordsLength; j++) {
                        if (wordsArray[i + j].value.toLowerCase()
                            !== searchWords[j].toLowerCase()) {
                            matches = false
                            break
                        }
                    }
                    if (!matches) continue
                    const phraseStartIndex = wordsArray[i].id
                    const phraseEndIndex = wordsArray[i + searchWordsLength - 1].id
                    annotation.phraseBoundsIds =
                        [phraseStartIndex, phraseEndIndex]
                    annotationsWithPhraseBounds.push(annotation)
                }
            })

            setEntries(annotationsWithPhraseBounds)
            setResults({ ...$result, transcript, annotations: null })
        }
    }, [$result])

    const [$isDoneMakingEntries, setIsDoneMakingEntries] = useState(false)

    // input Form
    const dataElemNumSelect = useRef(null)
    const dataElemValueSelect = useRef(null)
    const [$selectedDataElemNum, setSelectedDataElementNum] = useState(null)
    const [$selectedDataElemVal, setSelectedDataElemVal] = useState(null)
    const [$entryToEdit, setEntryToEdit] = useState(null)

    const cancelSelectionButton = useRef(null)
    const showEntriesFormButton = useRef(null)

    const [$showEntriesForm, setShowEntriesForm] = useState(false)

    // prompt user to confirm leaving page with unsubmitted work
    useEffect(() => {
        $entries.length && (window.onbeforeunload = e => e.preventDefault())
    }, [$entries.length])

    // update text selection when a word is clicked
    useEffect(() => {
        if ($clickedWordId && !$selectionBoundsIds.length) {
            selectFirstWord()
        } else if ($selectionBoundsIds.length === 1) {
            selectLastWord()
        }
    }, [$clickedWordId])

    return (
        <div
            id="med-code-assignment-view"
            onKeyDown={onKeyDown}
        >
            {/* { // COMMENTED OUT: not sure if we'll want this yet
            // show the instructions if there are no entries
                $entries.length === 0 &&
                <div id="instructions">
                    <p>How to start:</p>
                    <ul>
                        <li> To select a phrase, click the first word, then click the last word. </li>
                        <li> To select a single word, double-click it. </li>
                        <li> Once a selection has been made, the first dropdown will appear. </li>
                        <li> Once an option is selected from the first dropdown, a second will appear. </li>
                        <li> Once an option is selected from the second dropdown, click Save Entry. </li>
                        <li> Press the Escape key to clear the current text selection and entry popup. </li>
                    </ul>
                </div>} */}

            {/* TEMPORARY UPLOAD FILE FORM
                TODO: add audio recorder + auto upload on stop recording */}
            <form className="pb-3">
                <input type="file" name="audio-file" id="audio-file" />
                <button
                    id="upload-button"
                    className={"btn btn-success"}
                    onClick={async (event) => uploadAndGetResults(event)}
                >
                    Upload
                </button>
            </form>

            {// show a clear selection button after starting a selection
                $selectionBoundsIds.length === 1 &&
                <button
                    id="clear-selection-button"
                    className="btn btn-danger"
                    type="button"
                    ref={cancelSelectionButton}
                    onClick={() => idle()}
                >
                    Clear
                </button>}

            <button
                ref={showEntriesFormButton}
                id="show-entries-form-button"
                type="button"
                className="btn btn-primary"
                onClick={() => {
                    setShowEntriesForm(!$showEntriesForm)
                    setIsDoneMakingEntries(false)
                    idle()
                }}
            >
                {$showEntriesForm ? 'Hide Entries' : 'Show Entries'}
            </button>

            <div  // map the words array to Words if the transcript has loaded
                id="transcript"
                tabIndex={0}
                onClick={addBoundToSelection}
                onDoubleClick={selectSingleWordAsPhrase}
            >
                {!$result?.transcript?.wordsArray
                    ? <div>
                        {$statusMessage}
                    </div>
                    : $result.transcript.wordsArray.map(word => (
                        <Word
                            key={word.id}
                            id={word.id}
                            value={word.value}
                            consumed={
                                $entries.length && isWordIdInEntries(word.id)
                            }
                            selected={
                                $entries.length && isWordIdInSelection(word.id)
                            }
                            entriesStartingWithWord={
                                entriesStartingWithWord(word.id)
                            }
                            editEntry={editEntry}
                        />
                    ))}
            </div>

            {// show the add entry popup when text is selected
                $selectionBoundsIds.length === 2 &&
                !$showEntriesForm &&
                !$entryToEdit &&
                <>
                    <div className="popup-bg-overlay" />
                    <EntryInputPopup
                        ref={{ dataElemNumSelect, dataElemValueSelect }}
                        dataElemNumOptions={dataElemNumOptions}
                        dataElemEnumerations={dataElemEnumerations}
                        selectedWords={
                            phraseFrom(
                                $result.transcript.wordsArray,
                                $selectionBoundsIds
                            )
                        }
                        getters={{
                            $selectedDataElemNum,
                            $selectedDataElemVal,
                            $selectionBoundsIds
                        }}
                        setters={{
                            setSelectedDataElementNum,
                            setSelectedDataElemVal,
                            setSelectionBoundsIds,
                            setEntryToEdit,
                        }}
                        callbacks={{ idle, addNewEntry }}
                    />
                </>}

            {// when a phrase's edit button is clicked, show the edit entry popup
                $entryToEdit && !$showEntriesForm &&
                <>
                    <div className="popup-bg-overlay" />
                    <EntryInputPopup
                        ref={{ dataElemNumSelect, dataElemValueSelect }}
                        dataElemNumOptions={dataElemNumOptions}
                        dataElemEnumerations={dataElemEnumerations}
                        selectedWords={
                            phraseFrom(
                                $result.transcript.wordsArray,
                                $entryToEdit.phraseBoundsIds
                            )
                        }
                        getters={{
                            $selectedDataElemNum,
                            $selectedDataElemVal,
                            $selectionBoundsIds,
                            $entryToEdit
                        }}
                        setters={{
                            setSelectedDataElementNum,
                            setSelectedDataElemVal,
                            setSelectionBoundsIds,
                            setEntryToEdit
                        }}
                        callbacks={{ idle, saveEditedEntry, deleteEntry }}
                    />
                </>}

            {// show the entries form when the show entries button is clicked
                $showEntriesForm &&
                <EntriesFormPanel
                    ref={{ dataElemNumSelect, dataElemValueSelect }}
                    idle={idle}
                    transcript={$result.transcript}
                    getters={{ $entries, $entryToEdit, $isDoneMakingEntries }}
                    setters={{
                        setEntryToEdit,
                        setShowEntriesForm,
                        setIsDoneMakingEntries
                    }}
                    entryInputProps={{
                        isInEntriesForm: true,
                        selectedWords: $entryToEdit
                            ? phraseFrom(
                                $result.transcript.wordsArray,
                                $entryToEdit.phraseBoundsIds
                            )
                            : undefined,
                        getters: {
                            $selectedDataElemNum,
                            $selectedDataElemVal,
                            $selectionBoundsIds,
                            $entryToEdit,
                        },
                        setters: {
                            setSelectedDataElementNum,
                            setSelectedDataElemVal,
                            setSelectionBoundsIds,
                            setEntryToEdit,
                        },
                        callbacks: { idle, saveEditedEntry, deleteEntry }
                    }}
                />}
            <hr />

            {/* {// COMMENTED OUT: doubt we'll need this holdover from Trainer
            // show the done button when entries exist
                $entries.length > 0 &&
                <button
                    type="button"
                    id="done-btn"
                    className="btn btn-primary"
                    onClick={onClickDoneButton}
                >
                    Done
                </button>} */}
        </div>
    )

    async function uploadAndGetResults(event) {
        event.preventDefault()
        if (isFileInputEmpty()) return

        // upload the file
        const { form } = event.target
        let statusMessage = null
        const formData = new FormData(form)
        try {
            const uploadResponse = await fetch('api/upload', {
                method: 'POST', body: formData
            })
            let { success, msg } = await uploadResponse.json()
            statusMessage = `${success ? 'Success!' : 'Failed.'} ${msg}`
            // TODO: if not success, try a few more times
            setStatusMessage(statusMessage)
            await updateUI()
            console.log(statusMessage)
        } catch (e) {
            const message =
                `Could not upload file. Please check your connection.\
                Error: ${e}`
            setStatusMessage(message)
            console.log("ERROR:", message)
            return
        }

        // get the result,
        // do not time out -- wait for the whole process 
        // to complete on the server

        statusMessage = statusMessage + '\nRequesting results...'
        setStatusMessage(statusMessage)
        await updateUI()
        try {
            const resultResponse = await fetch('api/result')
            let {
                error,
                transcript,
                narrative,
                annotations,
            } = await resultResponse.json()
            if (error) {
                const message = `Server Error: ${error}`
                setStatusMessage(message)
                console.log("ERROR:", message)
                return
            }
            setStatusMessage(null)
            setResults({ transcript, narrative, annotations })
        } catch (e) {
            const message =
                `Could not make the result request. \
                Please check your connection. Error: ${e}`
            setStatusMessage(message)
            console.log("ERROR:", message)
            return
        }
    }

    function isFileInputEmpty() {
        return !document.getElementById('audio-file')?.files.length ?? true
    }

    // METHODS +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++

    function idle() {
        setClickedWordId(null)
        setSelectionBoundsIds([])  // clear the selection 
        setEntryToEdit(null)
        // clear the form
        setSelectedDataElemVal(null)
        setSelectedDataElementNum(null)
    }

    function selectFirstWord() {
        setSelectionBoundsIds([$clickedWordId])
    }

    function selectLastWord() {
        let firstWordId = $selectionBoundsIds[0]
        let lastWordId = $clickedWordId
        if (lastWordId < firstWordId) {
            lastWordId = firstWordId
            firstWordId = $clickedWordId
        }
        setSelectionBoundsIds([firstWordId, lastWordId])
    }

    function addNewEntry() {
        if (!$selectedDataElemVal || !$selectedDataElemNum) return
        // add the new entry to the array
        const dataElemName = $selectedDataElemNum.label
            .split(' :: ')[1]
        const codeDescription = $selectedDataElemVal.label
            .split(' :: ')[1] ?? null
        setEntries([
            ...$entries,
            newEntry(
                $entries.length,
                $selectedDataElemNum.value,
                $selectedDataElemVal.value,
                $selectionBoundsIds,
                dataElemName,
                codeDescription,
            )
        ])
        idle()
    }

    function saveEditedEntry() {
        if (!$selectedDataElemVal || !$selectedDataElemNum) return
        // replace the entry
        setEntries(
            $entries.map(entry => entry.id === $entryToEdit.id
                ? {
                    ...$entryToEdit,
                    // can only change these (if want to change phrase, must delete entire entry)
                    data_elem_num: $selectedDataElemNum.value,
                    data_elem_name: $selectedDataElemNum.label
                        .split(' :: ')[1],
                    data_elem_val: $selectedDataElemVal.value,
                    code_description: $selectedDataElemVal.label
                        .split(' :: ')[1] ?? null,
                }
                : entry
            )
        )
        idle()
    }

    function deleteEntry() {
        setEntries($entries.filter(entry => entry.id !== $entryToEdit.id))
        idle()
    }

    /** Selects the first or last word of a phrase to add an entry for it */
    function addBoundToSelection(event) {
        event.preventDefault()
        const wordElem = event.target
        if (!wordElem.className.includes('word')) return
        const wordId = parseInt(wordElem.dataset.id)
        setClickedWordId(wordId)
    }

    /** Selects a single word as the phrase for an entry */
    function selectSingleWordAsPhrase(event) {
        event.preventDefault()
        const wordElem = event.target
        if (!wordElem.className.includes('word')) return
        const wordId = parseInt(wordElem.dataset.id)
        setClickedWordId(wordId)
        selectLastWord()
    }

    /** Return an array id's of entries with phrases starting with a word */
    function entriesStartingWithWord(wordId) {
        return $entries.filter(entry => {
            const firstWordIndex = entry.phraseBoundsIds[0]
            return $result.transcript.wordsArray[firstWordIndex].id === wordId
        })
    }

    function editEntry(entryId) {
        setEntryToEdit($entries.find(entry => entry.id === entryId) ?? null)
    }

    function isWordIdInSelection(wordId) {
        const [firstWordId, lastWordId] = $selectionBoundsIds
        if (firstWordId === undefined) return
        if (lastWordId === undefined) return wordId === firstWordId
        return wordId >= firstWordId && wordId <= lastWordId
    }

    function isWordIdInEntries(wordId) {
        return $entries.find(entry => (
            wordId >= entry.phraseBoundsIds[0]
            && wordId <= entry.phraseBoundsIds[1]
        )) ? true : false
    }

    function onKeyDown(event) {
        const { key } = event
        if (key === 'Escape') {
            event.preventDefault()
            if ($selectionBoundsIds.length === 1) {
                // the first word of a selection was chosen
                cancelSelectionButton.current.click()
            } else if ($showEntriesForm
                && !$selectionBoundsIds.length
                && !$entryToEdit) {
                // showing entries form, no selection made, & not editing entry
                showEntriesFormButton.current.click()
            }
        }
    }

    function onClickDoneButton() {
        setShowEntriesForm(true)
        setIsDoneMakingEntries(true)
    }
}

// END MAIN VIEW COMPONENT +++++++++++++++++++++++++++++++++++++++++++++++++++++

const Word = memo(_Word, (prevProps, nextProps) => (
    prevProps.selected === nextProps.selected
    && prevProps.consumed === nextProps.consumed
))

async function updateUI() {
    await new Promise(resolve => setTimeout(resolve, 0))
}

function _Word({
    value,
    id,
    selected = false,
    consumed = false,
    entriesStartingWithWord = [],
    editEntry
}) {
    let classes = ['word']
    selected && classes.push('selected')
    consumed && !selected && classes.push('consumed')  // prioritize selected (keeps selection style visible when selection overlaps consumed words)
    classes = classes.join(' ')
    return (
        <span
            className={classes}
            data-id={id}
        >
            {value}
            {// a button for each entry where this word is the first it it's phrase
                // this is an array to account for overlaps -- 
                // if the phrases of two entries start with the exact same word, 
                // we need an edit button for each 
                entriesStartingWithWord.length > 0 &&
                <div className="buttons">
                    {entriesStartingWithWord.map(entry => (
                        // edit entry button
                        <button
                            key={entry.id}
                            type="button"
                            className="btn btn-warning"
                            onClick={() => editEntry(entry.id)}
                        >
                            {entry.id + 1}
                        </button>
                    ))}
                </div>}
        </span>
    )
}

const EntryInputPopup = forwardRef(_EntryInputPopup)

function _EntryInputPopup({
    isInEntriesForm = false,
    selectedWords,
    getters,
    setters,
    callbacks,
}, refs) {
    const { $selectedDataElemNum, $selectedDataElemVal, $entryToEdit } = getters
    const {
        setSelectedDataElementNum,
        setSelectedDataElemVal,
        setSelectionBoundsIds,
        setEntryToEdit,
    } = setters
    const { dataElemNumSelect, dataElemValueSelect } = refs

    const { idle, addNewEntry, saveEditedEntry, deleteEntry } = callbacks

    const saveButton = useRef(null)
    const cancelButton = useRef(null)
    const deleteButton = useRef(null)

    const [$inputErrorMsgs, setInputErrorMsgs] = useState(null)

    // keep a ref to the data elem value/code options to add one so that it 
    // populates the input field
    const [$dataElemValueOptions, setDataElemValueOptions] = useState([])

    // if editing an entry, set all the state vars used by the 
    // state machine to update the entries and entries form
    useEffect(() => {
        if (!$entryToEdit) return
        const { data_elem_num, data_elem_val } = $entryToEdit
        const dataElemValOpts =
            dataElemEnumerations[data_elem_num]
            ?? [{ value: data_elem_val, label: data_elem_val }]
        setSelectionBoundsIds($entryToEdit.phraseBoundsIds)
        setSelectedDataElementNum({
            value: data_elem_num,
            label: dataElemNumOptions
                .find(option => option.value === data_elem_num).label
        })
        setDataElemValueOptions(dataElemValOpts)
        setSelectedDataElemVal({
            value: data_elem_val,
            label: dataElemValOpts
                .find(option => option.value === data_elem_val)?.label
                // if not found, this data elem expects an arbitrary input
                ?? data_elem_val
        })
    }, [$entryToEdit])

    // once the data elem has been selected,
    // set the data elem value and focus the data elem val 
    useEffect(() => {
        if (!$selectedDataElemNum) return
        // if there are no selectable options for this data elem num, 
        // it expects an arbitrary value from the text input 
        setDataElemValueOptions(
            dataElemEnumerations[$selectedDataElemNum.value] ?? []
        )
        dataElemValueSelect?.current.focus()
    }, [$selectedDataElemNum])

    // focus the data elem select on load
    useEffect(() => { dataElemNumSelect.current.focus() }, [])

    return (
        <div
            id="entry-input"
            className={isInEntriesForm ? '' : 'popup'}
            onKeyDown={onKeyDownForm}
            tabIndex={0}
        >
            <div className="card w-100 mb-3">
                <div className="card-header">
                    <div>
                        <button
                            ref={cancelButton}
                            id="cancel-input-btn"
                            type="button"
                            className="btn btn-warning d-inline"
                            onClick={() => {
                                setInputErrorMsgs(null)
                                idle()
                            }}
                        >
                            Cancel
                        </button>
                        {$entryToEdit
                            ? `${$entryToEdit.id + 1}. `
                            : 'New Entry: '}
                        {`"${selectedWords}"`}
                    </div>

                    {// show validation errors if they exist
                        $inputErrorMsgs &&
                        <div className="text-danger">
                            <hr className="mb-2" />
                            <p>Errors:</p>
                            <ul className="my-0">
                                {$inputErrorMsgs.map((msg, i) => (
                                    <li key={i}>{msg}</li>)
                                )}
                            </ul>
                        </div>}
                </div>
                <ul className="list-group list-group-flush">
                    <li className="list-group-item">
                        <Select
                            name="data-elem-num"
                            ref={dataElemNumSelect}
                            placeholder="Search by Data Element Number (e.g. eVitals.03)..."
                            options={dataElemNumOptions}
                            isClearable
                            onChange={(selected) => onChangeDataElemSelect(selected)}
                            openMenuOnFocus={$entryToEdit ? false : true}
                            tabSelectsValue={true}
                            value={$selectedDataElemNum}
                            className="w-100"
                        />
                    </li>

                    {// show the data elem value select once we're able to populate it
                        ($selectedDataElemNum || $entryToEdit) &&
                        <li className="list-group-item">
                            <Creatable
                                name="data-elem-val"
                                ref={dataElemValueSelect}
                                placeholder="Enter a value or search for a code description..."
                                options={$dataElemValueOptions}
                                isClearable
                                onChange={(selected) => onChangeDataElemValueSelect(selected)}
                                openMenuOnFocus={$entryToEdit ? false : true}
                                tabSelectsValue={true}
                                formatCreateLabel={inputValue => `${inputValue}`}
                                noOptionsMessage={_ => "This Data Element expects an arbitrary value"}
                                onCreateOption={inputValue => onCreateOption(inputValue, $selectedDataElemNum)}
                                createOptionPosition="first"
                                value={$selectedDataElemVal}
                                className="w-100"
                            />
                        </li>}
                </ul>
                <div className="card-footer">
                    <div className="buttons">
                        {$entryToEdit &&
                            <button
                                ref={deleteButton}
                                type="button"
                                className="btn btn-danger"
                                onClick={attemptDeleteEntry}
                            >
                                Delete Entry
                            </button>}

                        {// show save button when form is complete and valid
                            $selectedDataElemNum &&
                            $selectedDataElemVal &&
                            !$inputErrorMsgs &&
                            <button
                                ref={saveButton}
                                type="button"
                                className="btn btn-success"
                                onClick={$entryToEdit ? saveEditedEntry : addNewEntry}
                                disabled={$inputErrorMsgs ? true : false}
                            >
                                Save Entry &nbsp;⏎
                            </button>}
                    </div>
                </div>
            </div>
        </div>
    )

    function onChangeDataElemSelect(selected) {
        setSelectedDataElementNum(selected)
        setSelectedDataElemVal(null)
        setInputErrorMsgs(null)
    }

    function onChangeDataElemValueSelect(selected) {
        setSelectedDataElemVal(selected)
        setInputErrorMsgs(null)
    }

    function onKeyDownForm(event) {
        const { key, metaKey, ctrlKey } = event
        if (key === 'Escape') {
            event.preventDefault()
            cancelButton.current.click()
        }
        if (metaKey || ctrlKey) {
            if (key === 'Backspace' || key === 'd') {
                event.preventDefault()
                deleteButton.current?.click()
            }
        }
    }

    function attemptDeleteEntry() {
        if (confirm(
            "Are you sure you want to delete this entry?\n\
            Press Enter to confirm."
        )) {
            deleteEntry()
        }
    }

    function onCreateOption(inputValue, dataElemNum) {
        // TODO: get this working when more than one data elem can be added!
        inputValue = inputValue.trim()
        const createdDataElemValue = { value: inputValue, label: inputValue }
        setSelectedDataElemVal(createdDataElemValue)
        setDataElemValueOptions([createdDataElemValue, ...$dataElemValueOptions])
        const { isValid, errorMsgs } = inputIsValid(inputValue, dataElemNum.value)
        if (!isValid) {
            setInputErrorMsgs(errorMsgs)
            return
        }
        setInputErrorMsgs(null)
    }

    function inputIsValid(inputValue, dataElemNum) {
        // This function is only called when the user inputs an arbitrary 
        // value, not when an option is selected from a list, since those are
        // guaranteed to be valid

        let result = { isValid: true, errorMsgs: [] }

        if (!dataElemTypeConstraints[dataElemNum]) {
            result.isValid = false
            result.errorMsgs = [
                `${dataElemNum} only accepts an option from the dropdown menu.`
            ]
            return result
        }

        const { restrictionType, restriction } =
            dataElemTypeConstraints[dataElemNum]

        const minInclusiveErrMsg =
            `Value must be greater than or equal to ${restriction['minInclusive']}.`
        const maxInclusiveErrMsg =
            `Value must be less than or equal to ${restriction['maxInclusive']}.`

        switch (restrictionType) {
            case 'string':
                if ('pattern' in restriction) {
                    const pattern = restriction['pattern']
                    const regex = new RegExp('^' + pattern + '$')
                    if (!regex.test(inputValue)) {
                        result.isValid = false
                        result.errorMsgs.push(
                            `Value did not match the required regex "${pattern}".`
                        )
                        return result
                    }
                }
                const inputLength = inputValue.length
                if ('length' in restriction) {
                    const length = restriction['length']
                    if (inputLength != length) {
                        result.isValid = false
                        result.errorMsgs.push(
                            `Value must be exactly ${length} characters.`
                        )
                    }
                }
                if ('minLength' in restriction) {
                    const minLength = restriction['minLength']
                    if (inputLength < minLength) {
                        result.isValid = false
                        result.errorMsgs.push(
                            `Value must be at least ${minLength} characters long.`
                        )
                    }
                }
                if ('maxLength' in restriction) {
                    const maxLength = restriction['maxLength']
                    if (inputLength > maxLength) {
                        result.isValid = false
                        result.errorMsgs.push(
                            `Value must be less than or equal to ${maxLength} characters long.`
                        )
                    }
                }
                break

            case 'integer':
                if (isNaN(inputValue)) {
                    result.isValid = false
                    result.errorMsgs.push(`Value must be an integer.`)
                }
                if (!isNaN(parseFloat(inputValue))) {
                    result.isValid = false
                    result.errorMsgs.push(`Value must be an integer.`)
                }
                if ('minInclusive' in restriction) {
                    if (inputValue < restriction['minInclusive']) {
                        result.isValid = false
                        result.errorMsgs.push(minInclusiveErrMsg)
                    }
                }
                if ('maxInclusive' in restriction) {
                    if (inputValue > restriction['maxInclusive']) {
                        result.isValid = false
                        result.errorMsgs.push(maxInclusiveErrMsg)
                    }
                }
                break

            case 'positiveInteger':
                if (isNaN(inputValue) || inputValue < 0) {
                    result.isValid = false
                    result.errorMsgs.push(`Value must be a positive integer.`)
                }
                if ('minInclusive' in restriction) {
                    if (inputValue < restriction['minInclusive']) {
                        result.isValid = false
                        result.errorMsgs.push(minInclusiveErrMsg)
                    }
                }
                if ('maxInclusive' in restriction) {
                    if (inputValue > restriction['maxInclusive']) {
                        result.isValid = false
                        result.errorMsgs.push(maxInclusiveErrMsg)
                    }
                }
                break

            case 'decimal':
                if (isNaN(inputValue)) {
                    result.isValid = false
                    result.errorMsgs.push(`Value must be a number.`)
                }
                // if (isNaN(parseFloat(inputValue))) {
                if (!isNaN(inputValue) || !inputValue.includes('.')) {
                    result.isValid = false
                    result.errorMsgs.push(`Value must be a number with a decimal.`)
                }
                if ('totalDigits' in restriction) {
                    const totalDigits = restriction['totalDigits']
                    // minus 1 to ignore the decimal
                    if (inputValue.length - 1 != totalDigits) {
                        result.isValid = false
                        result.errorMsgs.push(
                            `Value must contain exactly ${totalDigits} digits.`
                        )
                    }
                }
                if ('fractionDigits' in restriction) {
                    const fractionDigitCount = restriction['fractionDigits']
                    const [_, textAfterDecimal] = inputValue.split('.')
                    if (!textAfterDecimal
                        || textAfterDecimal.length != fractionDigitCount) {
                        result.isValid = false
                        result.errorMsgs.push(
                            `Value must have ${fractionDigitCount} digits after the decimal.`
                        )
                    }
                }
                if ('minInclusive' in restriction) {
                    if (inputValue < restriction['minInclusive']) {
                        result.isValid = false
                        result.errorMsgs.push(minInclusiveErrMsg)
                    }
                }
                if ('maxInclusive' in restriction) {
                    if (inputValue > restriction['maxInclusive']) {
                        result.isValid = false
                        result.errorMsgs.push(maxInclusiveErrMsg)
                    }
                }
                break

            case 'date':
                const inputDate = new Date(inputValue)

                // if input is not a date, new Date() will create an invalid 
                // Date object, which results in NaN when getTime() is called
                if (!isNaN(inputDate.getTime())) {
                    result.isValid = false
                    result.errorMsgs.push(
                        `Value must be a date in the format "YYYY-MM-DD".`
                    )
                }
                if ('minInclusive' in restriction) {
                    const minInclusive = restriction['minInclusive']
                    if (inputDate < new Date(minInclusive)) {
                        result.isValid = false
                        result.errorMsgs.push(
                            `Value must be a date later than or equal to ${minInclusive}.`
                        )
                    }
                }
                if ('maxInclusive' in restriction) {
                    const maxInclusive = restriction['maxInclusive']
                    if (inputDate > new Date(maxInclusive)) {
                        result.isValid = false
                        result.errorMsgs.push(
                            `Value must be a date before or equal to ${maxInclusive}.`
                        )
                    }
                }
                break
            case 'dateTime': // TODO: Do we need this? 
            // break
            case 'base64Binary': // TODO: Do we need this? 
            // break
            default:
                throw new Error(`Type "${restrictionType}" is not implemented yet.`)
        }
        return result
    }
}

// END ENTRY POPUP +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++

// entries form can contain an entry input popup, which forwards refs to its 
// parent, so forwardRef is used here to forward the refs thru the entries form
const EntriesFormPanel = forwardRef(_EntriesFormPanel)

function _EntriesFormPanel({
    transcript,
    getters,
    setters,
    entryInputProps,
    idle
}, refs) {
    const { $entries, $entryToEdit, $isDoneMakingEntries } = getters
    const {
        setEntryToEdit,
        setShowEntriesForm,
        setIsDoneMakingEntries,
    } = setters

    const submitButton = useRef()

    useEffect(() => {
        if (!$isDoneMakingEntries) return
        submitButton.current?.scrollIntoView(
            { behavior: "smooth", block: "start" }
        )
    }, [$isDoneMakingEntries])

    return (
        <div id="entries-form-panel">
            <form
                id="entries-form"
                method="POST"
            >
                {// map entries to the entries form 
                    $entries.map(entry => {
                        if ($entryToEdit?.id === entry.id) {
                            return (
                                <div
                                    key={entry.id}
                                    id={'entry_' + entry.id}
                                    className="entry"
                                >
                                    <EntryInputPopup
                                        ref={refs}
                                        {...entryInputProps}
                                    />
                                </div>
                            )
                        }
                        const {
                            id,
                            phraseBoundsIds,
                            data_elem_num,
                            data_elem_name,
                            data_elem_val,
                            code_description
                        } = entry
                        const phrase = phraseFrom(transcript.wordsArray, phraseBoundsIds)
                        return <div
                            key={id}
                            id={'entry_' + id}
                            className="entry"
                        >
                            <div className="card w-100 mb-3">
                                <div className="card-header">
                                    <p className="phrase">
                                        <button
                                            id="edit-entry-btn"
                                            type="button"
                                            className="btn btn-outline-primary d-inline"
                                            onClick={() => setEntryToEdit(entry)}
                                        >
                                            Edit
                                        </button>
                                        {`${id + 1}. "${phrase}"`}
                                    </p>
                                </div>
                                <ul className="list-group list-group-flush">
                                    <li className="list-group-item">
                                        {data_elem_num + ' :: ' + data_elem_name}
                                    </li>
                                    <li className="list-group-item">
                                        {data_elem_val + (
                                            code_description
                                                ? ' :: ' + code_description
                                                : ''
                                        )}
                                    </li>
                                </ul>
                            </div>
                        </div>
                    })}

                {// COMMENTED OUT: I can't foresee a use for a these buttons
                // now, but maybe in the future
                /* <div className="buttons p-2">
                    <button
                        className="btn btn-primary"
                        type="button"
                        onClick={() => {
                            setShowEntriesForm(false)
                            setIsDoneMakingEntries(false)
                            idle()
                        }}
                    >
                        ⇦&nbsp; Back to Transcript
                    </button>

                    <button
                        ref={submitButton}
                        className="btn btn-success"
                        id="submit-btn"
                        type="button"  // NOT submit!
                        disabled={$entryToEdit && true}
                        onClick={}
                    >
                        Create Entries JSON &nbsp;⇨
                    </button> 
                </div>*/}
            </form>
        </div>
    )
}

// END ENTRIES FORM ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++

// UTILITY FUNCTIONS +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++

function dataElemNameFrom(dataElemNum) {
    return validation_dict[dataElemNum].data_elem_name
}

function codeDescriptionFrom(dataElemNum, dataElemVal) {
    let { NV, PN, enumeration } = validation_dict[dataElemNum].restrictions
    if (!NV) NV = []
    if (!PN) PN = []
    if (!enumeration) enumeration = []
    for (let restriction of [...NV, ...PN, ...enumeration]) {
        const [code, codeDescription] = Object.entries(restriction)[0]
        if (code === dataElemVal) return codeDescription
    }
    return null
}

function newEntry(
    id,
    dataElemNum,
    dataElemVal,
    phraseBoundsIds,
    dataElemName,
    codeDescription = undefined
) {
    // keeping eventual json data in snake case
    // if in camelCase, will not be in the POSTed json data
    return {
        id,
        data_elem_num: dataElemNum,
        data_elem_name: dataElemName,
        data_elem_val: dataElemVal,
        code_description: codeDescription,
        phraseBoundsIds,
    }
}

function phraseFrom(wordsArray, phraseBounds) {
    return wordsArray
        .slice(phraseBounds[0], phraseBounds[1] + 1)
        .map(word => word.value)
        .join(' ')
}

function selectOptionsFromValidationDict() {
    const validationDictEntries = Object.entries(validation_dict)

    // data element options 
    // [{ value: data elem num, label: elem num + elem name }, ...]

    // data element enumerations
    // { data elem num: [{ value: code, label: code + description }, ...], ... }

    const dataElemNumOptions = []
    const dataElemEnumerations = {}
    const dataElemTypeConstraints = {}

    for (const [dataElemNum, info] of validationDictEntries) {
        dataElemNumOptions.push({
            value: dataElemNum,
            label: `${dataElemNum} :: ${info['data_elem_name']}`
        })

        dataElemEnumerations[dataElemNum] = []
        const restrictions = Object.entries(info['restrictions'])

        for (const [restrictionType, restriction] of restrictions) {
            if ("NV PN enumeration".includes(restrictionType)) {
                // is an array of objects with 1 key each
                for (const codeObj of restriction) {
                    const [[code, description]] = Object.entries(codeObj)
                    dataElemEnumerations[dataElemNum].push({
                        value: code, label: `${code} :: ${description}`
                    })
                }
                continue
            }
            // is an object with N keys containing the type constraints 
            // (eg minLengthInclusive = {}, length = {}, [regex]pattern = {})
            dataElemTypeConstraints[dataElemNum] =
                { restrictionType, restriction }
        }
    }
    return { dataElemNumOptions, dataElemEnumerations, dataElemTypeConstraints }
}

export function getCookie(name) {
    const { cookie } = document
    if (!cookie) return null
    const nameIndex = cookie.indexOf(name)
    if (nameIndex === -1) return null
    return cookie.substring(nameIndex + name.length + 1)  // +1 for equal sign
}

export function INSPECT(obj, description = '') { console.log(description, obj) }

// END UTILITY FUNCTIONS +++++++++++++++++++++++++++++++++++++++++++++++++++++++


/* 


TODO
- make tabs for transcript, narrative, annotations
- add audio recorder that uploads the audio file to backend


*/