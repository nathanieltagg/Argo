//
// Code for the Arachne Event Display
// Author: Nathaniel Tagg ntagg@otterbein.edu
// 
// Licence: this code is free for non-commertial use. Note other licences may apply to 3rd-party code.
// Any use of this code must include attribution to Nathaniel Tagg at Otterbein University, but otherwise 
// you're free to modify and use it as you like.
//

#include "JsonElement.h"

bool JsonElement::sfPrettyPrint = true;



std::ostream& operator<< (std::ostream& out, const JsonElement& e)
{
  out << e.str();
}


virtual const std::string JsonElement::quotestring( const str::string& s )
{
  // Enclose the provided string in quotes, and escape it properly.
  
}


// ----------------------------------------------------------------------------------
// JsonObject
JsonObject& JsonObject::add(const std::string& key,const JsonElement& value)
{
  if(fElements++>0) {
    fContent << ",";
  }
  if(sfPrettyPrint) fContent << std::endl << "  ";
  fContent << "\"" << key << "\":";
  fContent << value.str();
  return *this;
}

const std::string JsonObject::str() const
{
  std::string out = "{";
  out += fContent.str();
  if(sfPrettyPrint) {out += "\n  ";};
  out += "}";
  return out;
}



// ----------------------------------------------------------------------------------
// JsonArray

JsonArray& JsonArray::add(const JsonElement& value)
{
  if(fElements++>0) {
    fContent << ",";
  }
  if(sfPrettyPrint) fContent << std::endl << "  ";
  fContent << value;
  return *this;  
}

const std::string JsonArray::str() const
{
  std::string out = "[";
  out += fContent.str();
  out += "]";
  if(sfPrettyPrint) {out += "\n  ";};  
  return out;
        
        
}
 // Removes linker errors by demanding the templates get resolved.
 // see http://www.parashift.com/c++-faq-lite/templates.html
 // section 35.8 and 35.9
template JsonObject& JsonObject::add <double>(const std::string&, const double&);
template JsonObject& JsonObject::add <float> (const std::string&, const float&);
template JsonObject& JsonObject::add <unsigned int>(const std::string&, const unsigned int&);
template JsonObject& JsonObject::add <int>         (const std::string&, const int&);
template JsonObject& JsonObject::add <std::string>         (const std::string&, const std::string&);

