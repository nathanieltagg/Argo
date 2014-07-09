// This file contains the instructions that tell rootcint how to 
// build the Dictionary.cxx file.

#ifdef __CINT__
#pragma link off all globals;
#pragma link off all classes;
#pragma link off all functions;

#pragma link C++ class JsonElement+;
#pragma link C++ class JsonFixed+;
#pragma link C++ class JsonSigFig+;
#pragma link C++ class JsonObject+;
#pragma link C++ class JsonArray+;


#pragma link C++ function FormulaMakeElement;
#pragma link C++ function FormulaMakeArray;
//#pragma link C++ function test_fma;


#pragma link C++ class vector<vector<unsigned int> >+;

//#pragma link C++ class art::ProductID+;
//#pragma link C++ class art::RefCore+;
//#pragma link C++ class art::RefCore::RefCoreTransients+;
//#pragma link C++ class art::Assn+;


#endif
