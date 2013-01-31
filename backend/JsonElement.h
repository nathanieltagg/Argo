#ifndef XML_FUNCTIONS_H
#define XML_FUNCTIONS_H

#include <ostream>
#include <sstream>
#include <string>
#include <iomanip>

// Automatic template function to aid streaming, make code slightly tighter.



class XmlElement;

class XmlElement 
{
  public:
  XmlElement() { fixed(); }; // null element.
  XmlElement(const std::string& tag) : fTag(tag) { fixed(); };
  // XmlElement(XmlElement& o) : fTag(o.fTag), fAttributes(o.fAttributes), fContent(o.fContent) {};

  template<typename T> XmlElement(const std::string& tag, const T& val) 
  : fTag(tag) { fixed(); fContent << val; };

  XmlElement(const XmlElement& o) : fTag(o.fTag), fAttributes(o.fAttributes.str()), fContent(o.fContent.str()) {fixed();};
  
  template<typename T>
  void addAttr(const std::string& attr, const T& val) {
    fAttributes << " " << attr << "=\"" << val << "\"";
  }
  
  virtual void fixed(int decimals=2) {
    fContent << std::fixed << std::setprecision(decimals); 
    fAttributes << std::fixed << std::setprecision(decimals); 
  }
  
  virtual const std::string str() const {
    if(fTag.length()==0) return "";

    std::string out = "<" + fTag;
    std::string attrstr = fAttributes.str();
    if(attrstr.length()>0) out += attrstr;
    std::string content = fContent.str();
    if(content.length()>0){
      out += ">" + content+ "</" + fTag + ">";
    } else {
      out += "/>";
    }
    return out;
  }
  
  template<typename T>
  XmlElement& operator<<(const T& val) {
    fContent << val;
    return *this;
  }

  std::string       tag() const { return fTag; }
  std::string       content() const { return fContent.str(); }
  std::string       attributes() const { return fAttributes.str(); }
  
  protected:
  std::string        fTag;
  std::ostringstream fAttributes;
  std::ostringstream fContent;
};

class XmlRootElement : public XmlElement
{
public:
  XmlRootElement(const std::string& tag) : XmlElement(tag) {};

  virtual const std::string str() const {
    std::string out = "<?xml version=\"1.0\" encoding=\"ISO-8859-1\"?>\n";
    out += XmlElement::str();
    return out;
  }
  
};

std::ostream& operator<< (std::ostream& out, const XmlElement& e);


/**
 * Escape characters that will interfere with xml.
 *
 * @param sSrc The src string to escape.
 * @return sSrc encoded for insertion into xml.
 */
std::string encodeForXml( const std::string &sSrc );


#endif /* XML_FUNCTIONS_H */

