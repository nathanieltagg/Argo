#ifndef JSONELEMENT_H_OHORH0IJ
#define JSONELEMENT_H_OHORH0IJ

#include <ostream>
#include <sstream>
#include <string>
#include <iomanip>
#include <TString.h>
#include <math.h>

class JsonElement;
class JsonObject;
class JsonArray;

// A JsonElement is anything that goes to the right of a colon in an assignment.
class JsonElement
{  
public: 
    JsonElement() { fixed(); }; // Null element.
    JsonElement(const JsonElement& c) { fixed(); fContent.str(c.fContent.str()); }; // Copy constructor.
    void operator=(const JsonElement& c) { fixed(); fContent.str(c.fContent.str()); }; // Copy constructor.
    JsonElement(const std::string& value) { fixed(); fContent << quotestring(value); }; 
    JsonElement(const char*        value) { fixed(); fContent << quotestring(value); }; 
    JsonElement(const TString& value) { fixed(); fContent << quotestring(value.Data()); }; 
    JsonElement(const unsigned int value) { fixed(); fContent << value; }
    JsonElement(const       int value) { fixed(); fContent << value; }
    JsonElement(const      long value) { fixed(); fContent << value; }
    JsonElement(const long long value) { fixed(); fContent << value; }
    JsonElement(const float value, int prec=-999) { fixed(prec); if(isnan(value)) fContent << "\"nan\""; else fContent << value; }
    JsonElement(const double value,int prec=-999) { fixed(prec); if(isnan(value)) fContent << "\"nan\""; else fContent << value; }
    JsonElement(const bool value) { fixed(); fContent << ((value)?("true"):("false"));  }

    virtual const std::string str() const {  return (fContent.str().length()<1)?"null":fContent.str(); }
    
    virtual void fixed() {
      fContent << std::fixed << std::setprecision(sfDecimals); 
    }
    
    virtual void fixed(int decimals) {
      if(decimals==-999) decimals=JsonElement::sfDecimals;
      fContent << std::fixed << std::setprecision(decimals); 
    }
    
    static void SetPrettyPrint(bool onf) { sfPrettyPrint = onf; }

    static int  sfDecimals;
protected:
    static bool sfPrettyPrint;
    virtual const std::string quotestring( const std::string& s );
    std::ostringstream fContent;
    
};

// A JsonObject is anything that is inside curly braces {}.
class JsonObject : public JsonElement
{
public:
  JsonObject() : JsonElement() , fElements(0) {fContent.str(""); };
  JsonObject(const JsonObject& c) { fixed(); fContent << c.fContent.str(); fElements = c.fElements; };
  void operator=(const JsonObject& c) { fixed(); fContent.str(c.fContent.str());fElements = c.fElements; }; // Copy constructor.
  virtual JsonObject& add(const std::string& key,const JsonElement& value);
  virtual JsonObject& add(const std::string& key,const JsonArray& value);
  virtual JsonObject& addBare(const std::string& key,const std::string& value);
  
    
  // template<typename T>
  //   JsonObject& add(const std::string& key, const T& val) { add(key,JsonElement(val)); return *this; };
  // JsonObject& add(const std::string& key, const char* val) { add(key,JsonElement(val)); return *this; };
  
  virtual const std::string str() const;
protected:
  int fElements;
};
  
class JsonArray : public JsonElement
{
public:
  JsonArray() : JsonElement(), fElements(0) { fContent.str(""); };
  JsonArray(const JsonArray& c) { fixed(); fContent << c.fContent.str(); fElements = c.fElements; };
  
  virtual JsonArray& add(const JsonObject& value);
  virtual JsonArray& add(const JsonElement& value);
  virtual int        length() const { return fElements; };

  virtual const std::string str() const;  
protected:
  int fElements;
  
};

std::ostream& operator<< (std::ostream& out, const JsonElement& e);


#endif 

