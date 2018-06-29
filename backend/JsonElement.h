#ifndef JSONELEMENT_H_OHORH0IJ
#define JSONELEMENT_H_OHORH0IJ

#include <ostream>
#include <sstream>
#include <string>
#include <iomanip>
#include <math.h>
#include <cmath>
#include <vector>
#include <map>
#include <cstdio>

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
    JsonElement(const unsigned int value) { fixed(); fContent << value; }
    JsonElement(const       int value) { fixed(); fContent << value; }
    JsonElement(const      long value) { fixed(); fContent << value; }
    JsonElement(const long long value) { fixed(); fContent << value; }
    JsonElement(const size_t    value) { fixed(); fContent << value; }
    JsonElement(const float value, int prec=-999) { fixed(prec); if(!std::isfinite(value)) fContent << "\"nan\""; else fContent << value; }
    JsonElement(const double value,int prec=-999) { fixed(prec); if(!std::isfinite(value)) fContent << "\"nan\""; else fContent << value; }
    JsonElement(const bool value) { fixed(); fContent << ((value)?("true"):("false"));  }

    virtual const std::string str() const {  return (fContent.str().length()<1)?"null":fContent.str(); }
    virtual void setStr(const std::string& content) { fContent << content; } // bare copy, no quoting, use with caution
    
    virtual void fixed() {
      fContent << std::fixed << std::setprecision(sfDecimals); 
    }
    virtual void setfixed() {
      fContent  << std::fixed; 
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

class JsonElementBare : public JsonElement
{ 
public:
  // Use with caution. Does not quote strings.
  JsonElementBare() {};
  JsonElementBare(const std::string& value) { fContent << value; }
};

// This class is used to create values 
// with a fixed precision: e.g 0.01 mm or 0.1 pe.
// HOwever, it does it in a space saving way:
// JsonFixedVal(1234.567,0) -> 1234
// JsonFixedVal(1234.567,1) -> 1234.6
// JsonFixedVal(1234.567,2) -> 1234.57
// JsonFixedVal(1234.401,2) -> 1234.4   omits tailing zero
// JsonFixedVal(1234.001,2) -> 1234     omits decimal point and tailing zero

class JsonFixed : public JsonElement
{
public:
  JsonFixed(const double value, int prec=-999) 
  {
    if(!std::isfinite(value)) { fContent << "\"nan\""; return; }
    if(prec==-999) prec = JsonElement::sfDecimals;
    std::ostringstream oss;    
    oss << std::fixed << std::setprecision(prec) << value;
    std::string tmp = oss.str();
    int dec = prec;
    // remove trailing 0s after the decimal point.
    while(*tmp.rbegin()=='0' && dec>0) {
      dec--;
      tmp.erase(tmp.end()-1);
    }
    // remove trailing decimal point.
    if(*tmp.rbegin()=='.') tmp.erase(tmp.end()-1); 
    fContent << tmp;
  }
};


// This class is used to create values 
// with a relative precision: e.g 3 sig.figs.
// HOwever, it does it in a space saving way:
// X = exponent base 10 of value
// S = number of sig figs
// JsonFixedVal(0.0001234,3) -> 0.000123 (8 chars) -> 1.23e-04 (7 chars) X=-4 // As scientific prec=S-1 when S-X+1 >S+4 -> X < -3
// JsonFixedVal(0.001234 ,3) -> 0.00123 (7 chars)  -> 0.00123 (7 chars) X=-3 // As fixed, prec=S-X-1   when S-X+1<=S+4
// JsonFixedVal(0.1234 ,3)   -> 0.123 (5 chars)    -> 0.123 (5 chars)
// JsonFixedVal(1.234  ,3)   -> 1.23  (4 chars)    -> 1.23  (4 chars)
// JsonFixedVal(12.34  ,3)   -> 12.3  (4 chars)    -> 12.3  (4 chars)   
// JsonFixedVal(123.4  ,3)   -> 123.  (3 chars)    -> 123   (3 chars)   X=2 // integer when X+1 >= S
// JsonFixedVal(1234.0 ,3)   -> 1234.  (4 chars)   -> 1234   (4 chars)
// JsonFixedVal(12340  ,3)    -> 12340  (5 chars)  -> 12340   (5 chars) X=4 // integer when X+1 >= S
// JsonFixedVal(123400 ,3)    -> 123400 (6 chars)  -> 123400  (6 chars) X=5
// JsonFixedVal(1234000,3)    -> 1234000(7 chars)  -> 1.23e+06  (6 chars) X=6 // flip when X+1 > S+5
// Also removes trailing 0s at end, or trailing decimal points.

class JsonSigFig : public JsonElement
{
public:
  JsonSigFig(const double value, int S=3) {
    if(!std::isfinite(value)) { fContent << "\"nan\""; return; }
    // Find exponent
    int X = (int)floor(log10(value));
    char* buff = new char[S+10];
    if((X+1<S) ||  (X > S+4) ){
      // For most of the above cases, the %g format works well!
      sprintf(buff,"%.*g",S,value);
    } else { // if (X <= S+2) {
      sprintf(buff,"%d",(int)value);
    }
    fContent << buff;
    delete [] buff;
  }
};

// A JsonObject is anything that is inside curly braces {}.
class JsonObject : public JsonElement
{
public:
  JsonObject() : JsonElement()  {fContent.str(""); };
  JsonObject(const JsonObject& c) { fMap = c.fMap;  };
  void operator=(const JsonObject& c) { fMap = c.fMap; }; // Copy constructor.
  virtual JsonObject& add(const std::string& key,const JsonObject& value);
  virtual JsonObject& add(const std::string& key,const JsonArray& value);
  virtual JsonObject& add(const std::string& key,const JsonElement& value);
  virtual JsonObject& addBare(const std::string& key,const std::string& value);
    
  virtual const std::string str() const;
protected:
  typedef std::map<std::string,std::shared_ptr<JsonElement>> omap_t;
  omap_t fMap;
};


// A JsonObject is anything that is inside curly braces {}.
class JsonObjectSimple : public JsonElement
{
public:
  JsonObjectSimple() : JsonElement() , fElements(0) {fContent.str(""); };
  JsonObjectSimple(const JsonObjectSimple& c) { fixed(); fContent << c.fContent.str(); fElements = c.fElements; };
  void operator=(const JsonObjectSimple& c) { fixed(); fContent.str(c.fContent.str());fElements = c.fElements; }; // Copy constructor.
  virtual JsonObjectSimple& add(const std::string& key,const JsonElement& value);
  virtual JsonObjectSimple& add(const std::string& key,const JsonArray& value);
  virtual JsonObjectSimple& addBare(const std::string& key,const std::string& value);
  
    
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
  JsonArray(const std::vector<JsonObject>& in);
  template<typename T>
    JsonArray(const std::vector<T>& in);
  
  virtual JsonArray& add(const JsonObject& value);
  virtual JsonArray& add(const JsonElement& value);
  // template<typename T>
  //    JsonArray& add(const std::vector<T>& in);
  
  virtual int        length() const { return fElements; };

  virtual const std::string str() const;  
protected:
  int fElements;
  
};

std::ostream& operator<< (std::ostream& out, const JsonElement& e);



///
// Inlines

// Add a vector as an object array. Works as long as there's a way to change it into a JsonElement.
template<typename T>
JsonArray::JsonArray(const std::vector<T>& in) :   fElements(0)
{
  fixed();
  typename std::vector<T>::const_iterator itr;
  for ( itr = in.begin(); itr != in.end(); ++itr ) this->add(JsonElement(*itr));
}



// Deal explicitly with objects, which shouldn't be cast.
inline
JsonArray::JsonArray(const std::vector<JsonObject>& in) :   fElements(0)
{
  fixed();
  std::vector<JsonObject>::const_iterator itr;
  for ( itr = in.begin(); itr != in.end(); ++itr ) this->add(*itr);
}

#endif 

