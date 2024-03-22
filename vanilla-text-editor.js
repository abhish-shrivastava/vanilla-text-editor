const format_btn_list = [
    {
        for: "bold",
        tag: "STRONG",
        class: "bold",
        label_innerHTML: "<strong>B</strong>",
    },
    {
        for: "italic",
        tag: "EM",
        class: "italic",
        label_innerHTML: "<em>I</em>",
    },
    {
        for: "underline",
        tag: "SPAN",
        class: "underline",
        label_innerHTML: "<span class='underline'>U</span>",
    },
    {
        for: "important",
        tag: "SPAN",
        class: "imp",
        label_innerHTML: "<span class='imp'>imp</span>",
    },
    {
        for: "subscript",
        tag: "SUB",
        class: "sub",
        label_innerHTML: "X<sub>2</sub>",
    },
    {
        for: "superscript",
        tag: "SUP",
        class: "sup",
        label_innerHTML: "X<sup>2</sup>",
    },
    {
        for: "link",
        tag: "A",
        class: "a-link",
        label_innerHTML: "&#x1F517",
    },
];

function create_elem(style, label="") {
    const [tag_name, class_name] = style.split(".");
    const e = document.createElement(tag_name);
    if (class_name)
        e.classList.add(class_name);
    e.innerHTML = label;
    return e;
}

function create_format_button(format, editor) {

    format.style = `${format.tag}.${format.class}`;
    const b = document.createElement("button");
    b.innerHTML = format.label_innerHTML;
    b.format = format;
    b.format.editor = editor;
    b.addEventListener("click", format_sel);
    return b;
}

function get_text_editor(div) {

    div.setAttribute("contenteditable", true);
    div.classList.add("--editor");

    const tool_strip = create_elem("div.--tool-strip");
    format_btn_list.forEach( format => tool_strip.appendChild( create_format_button( format, div ) ) );

    const parent_div = create_elem("div.--text-editor");
    div.replaceWith(parent_div);
    parent_div.append( tool_strip, div );
    
    const link = document.createElement("link");
    link.setAttribute("rel", "stylesheet");
    link.setAttribute("href", "vanilla-text-editor.css");
    document.querySelector("head").appendChild(link);
}

function format_sel (event) {
      
    const editor = this.format.editor;
    if ( !(editor.textContent) ) return;

    const sel = window.getSelection().getRangeAt(0);
    const format_style = this.format.style;
    let parent_format_element;

    /* 
    the following if block checks if the format is already active completely on the selection inside and the format_element, like strong, em etc lies outside. This means the user wants to remove "this" format. If entire selection is already in the clicked button's format say bold, then it means that one of the selection's common ancestor container (which is "usually" a text node), is the format_element. The position below will be the position of format_element in the acestors list.
    */
    const common_ancestors = get_ances_list(sel.commonAncestorContainer, editor);
    const position = tags_position(common_ancestors, this.format.tag, this.format.class);

    if ( position < common_ancestors.length - 1 ) {        // if the position is not of the top most parent which is the editor itself

        // before_sel is the part of the content before the selected content inside the common_ancestors[position] element. Its entire formatting is to be retained.
        const before_sel = sel.cloneRange();
        before_sel.collapse(true);
        before_sel.setStartBefore(common_ancestors[position]);

        // same for the part of the content after the selected content.
        const after_sel = sel.cloneRange();
        after_sel.collapse(false);
        after_sel.setEndAfter(common_ancestors[position]);

        // the following loop extracts the selected contents and removes "this" format but retains the remaining formats "surrounding" the selection, if present.
        let next = sel.extractContents();
        let prev;
        for (let i = 0; i < common_ancestors.length - 1; i++) {

            if (i !== position) {
                prev = next;
                next = create_elem(`${common_ancestors[i].tagName}.${common_ancestors[i].classList[0]}`);
                next.appendChild(prev);
            }
        }

        parent_format_element = common_ancestors[position].parentElement;
        common_ancestors[position].replaceWith(before_sel.extractContents(), next, after_sel.extractContents());

    } else if( check_desc(sel, format_style) ) {
        /*  
        this block checks if the entire selection is still in format but it may not necessarily be contained in one element that lies outside. For instance, consider the following selection-
        <em><strong> Some text 1 </strong></em><span.underline><strong> Some text 2 </strong></span> 
        Both texts 1 and 2 are bold but contained in separate strong tags. If a user wants to disable the bold formatting for the entire selection in such a case, then this block does that.
        */

        const fragment = sel.extractContents();
        fragment.querySelectorAll(format_style).forEach( e => e.replaceWith(...e.childNodes) );
        sel.insertNode(fragment);
        parent_format_element = sel.commonAncestorContainer.parentElement;

    } else {
        /*  
        if the user instead wants to add "this" format to the selected text, then the following creates the relevant element for that format and the selection is appended to that element. The selection finally is replaced with the element. 
        */
        const elem = create_elem( `${this.format.tag}.${this.format.class}` );
        elem.appendChild(sel.extractContents());
        sel.insertNode(elem);
        parent_format_element = elem.parentElement;
    }

    html_cleanup(parent_format_element, format_style);       // to clean up the html of unnecessay and empty tags.
    window.getSelection().removeAllRanges();                // remove all selections.

}

function check_similar(e1, e2) {

    if ( e1.tagName === e2.tagName ) {
            if( e1.getAttribute("class") && !e2.classList.contains( e.getAttribute("class") ) ) 
                return false;
            return true;
        }
}

function html_cleanup(parent_elem, format_style) {
    /*  
    The first part of this function removes similar child format elements. For example- 
    <strong>some text 1 <em>some text 2 <strong>some text 3</strong></em></strong>. There is no need for the inner strong element in the above case.
    */
    const whitespace = /^\s*$/;
    let prev;

    parent_elem.querySelectorAll(format_style).forEach( e => {
        if( Array.from(parent_elem.children).includes(e) )
            e.querySelectorAll(format_style).forEach( i => i.replaceWith(...i.childNodes) );

        if( e.previousElementSibling === prev && ( !(e.previousSibling.nodeType == Node.TEXT_NODE) || (whitespace.test(e.previousSibling.textContent)) ) ) 
            prev.appendChild(...e.childNodes);
        else
            prev = e;
    });

    parent_elem.querySelectorAll("*").forEach( e => { 
        const all_format_tags = format_btn_list.map( (format) => format.tag, this );
        if( all_format_tags.includes(e.tagName) && !e.textContent )
            e.remove();
    });
}

function check_desc(sel, format_style) {
    /*
    This function checks if the "entire" selection's text is formatted with one or more format_style elements which can be nested inside the selection. For instance, consider the following selection-
    <em><strong> Some text 1 </strong></em><span.underline><strong> Some text 2 </strong></span> 
    Both texts 1 and 2 are bold but contained in separate strong tags. It works by extracting the text contents of all the format_style elements and comparing with the entire selection's text content. To keep it more accurate, whitespaces are removed from both and then compared.
    */
   
    const elem = document.createElement("div");
    elem.appendChild( sel.cloneContents() );
    
    let formatted_text = "";
    elem.querySelectorAll(format_style).forEach(e => formatted_text += e.textContent);
    formatted_text = formatted_text.replaceAll(/\s*/g, "");

    const container_text = elem.textContent.replaceAll(/\s*/g, "");

    if (formatted_text === container_text) return true;
    else return false;
}

function get_ances_list(elem, till) {           //self explanatory.
    let result = [];
    if (elem.nodeType === 3) elem = elem.parentElement;
    while (elem !== till) {
        result.push(elem);
        elem = elem.parentElement;
    }
    result.push(till);
    return result;
}

function tags_position(list, tag_name, class_name = "") {
    /*
    Searches for an element based on the given tag and class names inside the list. If a match is found, then its position is returned. If no match is found then the position is equal to the list.length-1, or in other words it points to the last (or top most) element of the list.
    */

    let i;
    for (i = 0; i < list.length - 1; i++) {

        if (list[i].tagName === tag_name) {
            if (class_name) {
                if (list[i].classList.contains(class_name)) break;
                else continue;
            }
            break;
        }
    }
    return i;
}