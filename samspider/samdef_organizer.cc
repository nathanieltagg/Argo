//
// Usage: a.out <prefix> 
//
// Given sorted_defs.txt, find all strings that match <prefix> (or consider all strings if prefix is empty)
// Of the considered strings, find all independent matches, much like
// tab-completion of files on the command line. 
// This allows for a clickable heirarchy of files.

#include <iostream>
#include <fstream>
#include <map>
#include <vector>
#include <string>
#include <string.h>

size_t nmatch(const char* s1, const char* s2) 
{
	size_t n=0;
	while(true) {
		if(s1[n]!=s2[n]) return n;
		if(s1[n] == 0) return n;
		if(s2[n] == 0) return n;
		n++;
	}
}

void printCandidate(const char* buff, bool complete, bool incomplete) 
{
	// std::cout << "+" << buff;
	// if(complete) std::cout << "+";
	// std::cout << std::endl;
	if(!complete || incomplete) {
		std::cout << "<a href='?def_starts_with=" << buff << "'>" << buff << "...</a>" << std::endl;
	} 
	if(complete) {
		std::cout << "<a href='?def=" << buff << "'>" << buff << "</a>" << std::endl;
	}
}

int main(int argc, const char** argv)
{
	const int kchars = 0; // Set to zero for independent strings
	 // set to 1 for two-character indpendent strings

	int nresults = 0;
	std::ifstream in("defs_sorted.txt");
	char linebuff[1000];
	char lastbuff[1000];
	lastbuff[0] = 0;
	size_t nLast = 0;
	bool last_is_complete = false;
	bool last_is_incomplete = false;

	std::string prefix = "";
	if(argc>1) { prefix = argv[1]; }

	// std::cout << "Searching for (" << prefix << ")" << std::endl;
	const char* cprefix = prefix.c_str();
	size_t lenprefix = prefix.length();


	std::string lastEntry = "";
	int i = 0;
	while(in.good()) {
		++i;
		// if((i%10000)==0) 
		// 	 std::cout << entry << std::endl;		
		in.getline(linebuff,999);
		int cmp = strncmp(linebuff,cprefix, lenprefix);
		if(cmp < 0) continue;  // not a match yet.
		if(cmp > 0) {
			//finished with prefix matches
			break;
		}		
		// std::cout << "--Consider-- " << linebuff << std::endl;
		size_t nm = nmatch(linebuff,lastbuff);
		if(nLast==0) { // there was no previous candidate
			// std::cout << "-No previous candidate" << std::endl;
			strcpy(lastbuff,linebuff);
			nLast = strlen(linebuff);
			last_is_complete = true;
			last_is_incomplete = false;
		} else if(nm<=lenprefix+kchars){ // there was a previous candidate, but it matches only to prefix.
			// std::cout << "-New match, output and reset" << std::endl;
			printCandidate(lastbuff,last_is_complete, last_is_incomplete); nresults++;
			strcpy(lastbuff,linebuff);
			nLast = strlen(linebuff);
			last_is_complete = true;
			last_is_incomplete = false;
		} else {
			// Slight match. Reduce to common.
			if(nLast > nm) last_is_complete = false;
			if(nLast == nm) last_is_incomplete = true; // there's a longer one.
			lastbuff[nm] = 0; // reterminate the string.
			nLast = nm;
			// std::cout << "-Slight match, new candidate is: " << lastbuff << std::endl;
		}
	}
	if(nLast > 0){ // empty last one.
			printCandidate(lastbuff,last_is_complete, last_is_incomplete);
			nresults++;
	}

	if(nresults==0) {
		std::cout << "No matches found for definitions starting with " << prefix << std::endl;
	}

}
