/**
 * Lexer Module
 * 
 * @param String
 * @param Grammar
 * @param Context (starting token)

 * @author Nate Ferrero
 */
module.exports = function(string, grammar, context) {

	/**
	 * Ensure context is found
	 * @author Nate Ferrero
	 */
	if(!context)
		context = grammar['--default-context'];
	if(!context)
		throw new Error("No context specified");

	/**
	 * Store tokens
	 */
	var tokens = [];
	var chr = '';

	/**
	 * Reset line and column numbers
	 */
	var lineNumber = 1;
	var colNumber = 0;
	
	/**
	 * Token start positions
	 */
	var tokenLine = 1;
	var tokenCol = 0;
	
	/**
	 * Go through the code one char at a time, starting with default token
	 */
	var length = string.length;
	
	var queue = '';
	var processImmediately = false;

	char_loop:
	for(var pointer = 0; pointer <= length; true) {
		
		/**
		 * Check if processing a forwarded char
		 */
		if(processImmediately) {
			
			/**
			 * Shut off process flag
			 */
			processImmediately = false;
		}
		
		/**
		 * Else get a new char
		 */
		else {
			
			// Get char at pointer
			chr = string.charAt(pointer);
			
			// Step ahead after we have the char
			pointer++;
			
			// Increment line count
			if(chr == "\n" || chr == "\r") {
				lineNumber++;
				colNumber = -1;
			}
			
			// Increment column count
			colNumber++;
		}
		
		// Check that the current token is defined
		if(typeof grammar[token] == 'undefined')
			throw new Error("Lexer Grammar Error: Undefined token `<i>token</i>` on line `tokenLine` at column `tokenCol` in `description`");
		
		// Use the token
		var xtoken = grammar[token];
		
		// Check for special token types
		if(xtoken['type']) {
			switch(xtoken['type']) {
				
				// Check if the token is conditional, which means that there's a choice of
				// which token rules to follow, depending on the conditions specified.
				case 'conditional':
					
					// Loop through all possible conditions
					xtoken_loop:
					for(var key in xtoken) {
						var condtoken = xtoken[key];
						
						// Skip the type
						if(key === 'type')
							continue;
					
						if(typeof condtoken['match-sequence'] == 'undefined') {
							xtoken = condtoken;
							break char_loop;
						}
						var seq = condtoken['match-sequence'];
						var index = count(tokens) - 1;
						
						
						/* DEBUG * /
							echo "<h2>Checking <code>token</code> conditional token</h2>";
						/* END DEBUG */
						
						var first = true;
						var scan = false;
						var startIndex = 0;
						for(match_token in condtoken['match-sequence']) {
							var match_value = condtoken['match-sequence'][match_token];
							
							if(first || scan) {
								while(tokens[index].name != match_token) {
									index--;
									if(first)
										startIndex = index;
									if(index < startIndex)
										break 2;
								}
								first = false;
								scan = false;
							}
							
							actual_token = tokens[index]->name;
							actual_value = tokens[index]->value;
							
							if(match_token == '*') {
								scan = true;
								index = count(tokens);
								continue;
							}
							
							/* DEBUG * /
								echo "<p>Comparing match token <strong>match_token</strong> with actual <strong>actual_token</strong>
								and expected value <strong>match_value</strong> with <strong>actual_value</strong></p>";
							/* END DEBUG */
							
							if(actual_token != match_token || actual_value != match_value)
								continue 2;
							index++;
						}
						
						/**
						 * The condition token is matched
						 */
						if(isset(condtoken['token'])) {
							switch(condtoken['token']) {
								case 'cdata-block':
									
									/**
									 * Jump to end of block
									 */
									token = condtoken['token'];
									start = pointer;
									pointer = strpos(source, condtoken['end'], start);
									if(pointer === false)
										pointer = strlen(source);
									chr .= substr(source, start, pointer - start);
									len = strlen(chr);
									for(i = 0; i < len; i++) {
										cx = substr(chr, i, 1);
										
										// Increment line count
										if(cx == "\n" || cx == "\r") {
											lineNumber++;
											colNumber = -1;
										}
										
										// Increment column count
										colNumber++;
									}
									break 3;
							}
						}
					}
					
					// If no conditional match found, throw exception
					throw new Exception("Tokenize Error: The tokenizer has encountered a conditional token `<i>token</i>` ".
						"that has no valid match in `description`");
					
				default:
					throw new Exception("Tokenize Error: The tokenizer has encountered an invalid token type `<i>xtoken[type]`
						after token `<i>token</i>` in `description`");
			
			}
		}
		
		/**
		 * Handle last token
		 */
		if(chr === false) {
			tokens[] = (object) array('name' => token, 'value' => queue,
				'line' => tokenLine, 'col' => tokenCol);
				
			break;
		}
		
		// Whether to check for the ' ' space token, matches all whitespace
		if(chr === "\n" || chr === "\r" || chr === "\t")
			checkchar = ' ';
		else
			checkchar = chr;
		
		// Check if the current token has an action for this char, both literal and *
		literal = isset(xtoken[checkchar]);
		star = isset(xtoken['*']);
		xmatch = false;
		xqueue = '';

		// Extended cases
		if(isset(xtoken['extended'])) {
			
			// Save pointer to reset
			oldPointer = pointer;

			foreach(xtoken['extended'] as match => qtoken) {
				sample = '';
				while(sample !== false) {
					sample = substr(source, ++pointer, strlen(match));
					if(sample == match) {

						/**
						 * Add the content before the match
						 * @author Nate Ferrero
						 */
						queue .= substr(source, oldPointer, pointer - oldPointer);

						xmatch = true;
						ntoken = qtoken;
						xqueue = substr(source, pointer + 1, strlen(match) - 1);
						pointer += strlen(match);

						break 2;
					}
				}

				// Reset if nothing found
				pointer = oldPointer;
			}
		}
		
		// If no extended match, use normal matching
		if(!xmatch) {

			// If no match, char is part of token and continue
			if(!literal && !star) {
				queue .= chr;
				continue;
			}
			
			// Load the next token
			ntoken = xtoken[literal ? checkchar : '*'];
		}

		// Handle '#drop' token
		if(ntoken === '#drop') {
			continue;	
		}
		
		// Handle '#self' token
		if(ntoken === '#self') {
			queue .= chr;
			continue;	
		}
		
		// Handle '#error' token
		if(ntoken === '#error') {
			throw new LexerSyntaxException("Syntax Error: Unexpected <code><b>'chr'</b></code>
				after `<i>token</i>` token `queue` on line lineNumber at column colNumber in `description`");
		}
		
		// Add the current token to the stack and handle queue
		tokens[] = (object) array('name' => token, 'value' => queue,
			'line' => tokenLine, 'col' => tokenCol);
		
		// Update line and column for next token
		tokenLine = lineNumber;
		tokenCol = colNumber;
		
		// Handle &tokens by immediately queueing the same char on the new token
		if(substr(ntoken, 0, 1) === '&') {
			token = substr(ntoken, 1);
			processImmediately = true;
			queue = '';
		}
		
		// Normal tokens will start queue on next char
		else {
			token = ntoken;

			// xqueue adds any special characters after the first character of the token (see above)
			queue = chr . xqueue;
		}
	}
	
	/**
	 * Return tokens
	 * @author Nate Ferrero
	 */
	return tokens;
}