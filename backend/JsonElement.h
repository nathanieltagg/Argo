#ifndef JSONELEMENT_H_OHORH0IJ
#define JSONELEMENT_H_OHORH0IJ

#include <ostream>
#include <sstream>
#include <string>
#include <iomanip>

class JsonElement;
class JsonObject;
class JsonArray;

// A JsonElement is anything that goes to the right of a colon in an assignment.
class JsonElement
{  
public: 
    JsonElement() { fixed(); fContent << "null"; }; // Null element.
    JsonElement(const JsonElement& c) { fixed(); fContent << c.fContent.str(); }; // Copy constructor.
    JsonElement(const std::string& value) { fixed(); fContent << quotestring(value); }; 
    JsonElement(const unsigned int value) { fixed(); fContent << value; }
    JsonElement(const  int value) { fixed(); fContent << value; }
    JsonElement(const float value) { fixed(); fContent << value; }
    JsonElement(const double value) { fixed(); fContent << value; }
    virtual const std::string str() const { return fContent.str(); }
    
    virtual void fixed(int decimals=2) {
      fContent << std::fixed << std::setprecision(decimals); 
    }
    
    static void SetPrettyPrint(bool onf) { sfPrettyPrint = onf; }
protected:
    static bool sfPrettyPrint;
    virtual const std::string quotestring( const std::string& s );
    std::ostringstream fContent;
    
};

// A JsonObject is anything that is inside curly braces {}.
class JsonObject : public JsonElement
{
public:
  JsonObject() : JsonElement() , fElements(0) {};
  JsonObject(const JsonObject& c) { fixed(); fContent << c.fContent.str(); fElements = c.fElements; };
  virtual JsonObject& add(const std::string& key,const JsonElement& value);
    
  template<typename T>
    JsonObject& add(const std::string& key, const T& val) { add(key,JsonElement(val)); return *this; };
  JsonObject& add(const std::string& key, const char* val) { add(key,JsonElement(val)); return *this; };
  
  virtual const std::string str() const;
protected:
  int fElements;
};
  
class JsonArray : public JsonElement
{
public:
  JsonArray() : JsonElement(), fElements(0) {};
  JsonArray(const JsonArray& c) { fixed(); fContent << c.fContent.str(); fElements = c.fElements; };
  
  virtual JsonArray& add(const JsonElement& value);
  virtual const std::string str() const;  
protected:
  int fElements;
  
};

std::ostream& operator<< (std::ostream& out, const JsonElement& e);


#endif 

