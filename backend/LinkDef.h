// This file contains the instructions that tell rootcint how to 
// build the Dictionary.cxx file.
#ifdef __CINT__
#include <vector>
#pragma link off all globals;
#pragma link off all classes;
#pragma link off all functions;

#pragma link C++ operators vector<vector<unsigned int>>;
#pragma link C++ operators vector<vector<unsigned int>>::iterator;
#pragma link C++ operators vector<vector<unsigned int>>::const_iterator;
#pragma link C++ operators vector<vector<unsigned int>>::reverse_iterator;


#endif
